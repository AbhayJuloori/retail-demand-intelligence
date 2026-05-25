"""Training entrypoint for the retail demand forecasting pipeline."""

from __future__ import annotations

import json
import logging
import pickle
import tempfile
from pathlib import Path

import mlflow
import mlflow.lightgbm
import numpy as np
import pandas as pd
from tqdm import tqdm

from ml.forecasting import (
    FEATURE_COLUMNS,
    LIGHTGBM_NUM_BOOST_ROUND,
    blend,
    ensemble_weights,
    forecast_lightgbm,
    forecast_prophet,
    rolling_backtest,
    train_lightgbm,
    train_prophet,
    wrmsse,
)
from ml.pipeline import engineer_features, load_m5_data, make_synthetic_data, preprocess, train_val_split

logger = logging.getLogger(__name__)


def main(
    use_synthetic: bool = False,
    n_synthetic_skus: int = 50,
    sku_sample: int | None = None,
    mlflow_experiment: str = "retail-demand-intelligence",
) -> None:
    """Train the Prophet + LightGBM ensemble and log artifacts to MLflow."""
    mlflow.set_experiment(mlflow_experiment)

    if use_synthetic:
        sales_df, prices_df, calendar_df = make_synthetic_data(n_skus=n_synthetic_skus)
    else:
        sales_df, prices_df, calendar_df = load_m5_data()

    tidy_df = preprocess(sales_df, prices_df, calendar_df)

    # Sample before feature engineering so we don't process all 57M rows
    all_skus = sorted(tidy_df["sku_id"].unique().tolist())
    if sku_sample is not None:
        rng = np.random.default_rng(42)
        sample_size = min(sku_sample, len(all_skus))
        skus = sorted(rng.choice(all_skus, size=sample_size, replace=False).tolist())
        tidy_df = tidy_df[tidy_df["sku_id"].isin(skus)].copy()
    else:
        skus = all_skus

    feature_df = engineer_features(tidy_df)
    train_df, val_df = train_val_split(feature_df, val_days=28)

    with mlflow.start_run() as run:
        mlflow.log_params(
            {
                "use_synthetic": use_synthetic,
                "n_skus": len(skus),
                "val_days": 28,
            }
        )

        booster = train_lightgbm(train_df)
        lgbm_n_estimators = getattr(booster, "best_iteration", None) or LIGHTGBM_NUM_BOOST_ROUND
        mlflow.log_params(
            {
                "lgbm_objective": "tweedie",
                "lgbm_num_leaves": 127,
                "lgbm_n_estimators": int(lgbm_n_estimators),
                "lgbm_learning_rate": 0.05,
                "lgbm_min_data_in_leaf": 20,
                "lgbm_feature_fraction": 0.8,
                "lgbm_bagging_fraction": 0.9,
                "lgbm_bagging_freq": 5,
                "lgbm_lambda_l1": 0.1,
                "lgbm_lambda_l2": 0.1,
                "lgbm_max_bin": 255,
            }
        )
        try:
            import shap

            shap_df = val_df.dropna(subset=FEATURE_COLUMNS + ["sales"])
            if not shap_df.empty:
                explainer = shap.TreeExplainer(booster)
                shap_values = explainer.shap_values(shap_df[FEATURE_COLUMNS])
                if isinstance(shap_values, list):
                    shap_values = shap_values[0]
                shap_array = np.asarray(shap_values, dtype=float)
                if shap_array.ndim == 3:
                    shap_array = shap_array[:, :, 0]
                mean_abs_shap = np.abs(shap_array).mean(axis=0)
                ranked_features = sorted(
                    zip(FEATURE_COLUMNS, mean_abs_shap, strict=False),
                    key=lambda item: item[1],
                    reverse=True,
                )[:10]
                shap_importance = {feature: float(value) for feature, value in ranked_features}
                with tempfile.TemporaryDirectory() as tmp_dir:
                    shap_path = Path(tmp_dir) / "shap_importance.json"
                    with shap_path.open("w", encoding="utf-8") as file_obj:
                        json.dump(shap_importance, file_obj, indent=2)
                    mlflow.log_artifact(str(shap_path))
        except Exception:
            pass

        prophet_models: dict[str, object] = {}
        weights_by_sku: dict[str, tuple[float, float]] = {}
        all_actuals: list[np.ndarray] = []
        all_preds: list[np.ndarray] = []

        for sku_id in tqdm(skus, desc="Training SKU Prophet models"):
            sku_val = val_df.loc[val_df["sku_id"] == sku_id].sort_values("date")
            if sku_val.empty:
                logger.warning("Skipping %s: no validation rows", sku_id)
                continue

            lgbm_preds = forecast_lightgbm(booster, sku_val)
            prophet_model = train_prophet(train_df, sku_id)
            if prophet_model is None:
                weights_by_sku[sku_id] = (0.0, 1.0)
                blended_preds = lgbm_preds
            else:
                prophet_models[sku_id] = prophet_model
                prophet_forecast = forecast_prophet(prophet_model, horizon=len(sku_val))
                prophet_preds = prophet_forecast["yhat"].to_numpy()
                w_prophet, w_lightgbm = ensemble_weights(prophet_preds, lgbm_preds, sku_val["sales"].to_numpy())
                weights_by_sku[sku_id] = (w_prophet, w_lightgbm)
                blended_preds = blend(prophet_preds, lgbm_preds, w_prophet, w_lightgbm)

            all_actuals.append(sku_val["sales"].to_numpy(dtype=float))
            all_preds.append(blended_preds)

        if all_actuals:
            actuals = np.concatenate(all_actuals)
            predictions = np.concatenate(all_preds)
            val_rmse = float(np.sqrt(np.mean((actuals - predictions) ** 2)))
            train_scale = float(
                train_df.sort_values(["sku_id", "date"]).groupby("sku_id")["sales"].diff().pow(2).mean()
            )
            val_wrmsse = wrmsse(pd.Series(actuals), pd.Series(predictions), train_scale)
        else:
            val_rmse = float("nan")
            val_wrmsse = float("nan")

        # Log core metrics + artifacts first so a kill during backtest doesn't lose the run
        mlflow.log_metric("val_rmse", val_rmse)
        mlflow.log_metric("val_wrmsse", val_wrmsse)
        mlflow.lightgbm.log_model(booster, "lightgbm_model")

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            prophet_path = tmp_path / "prophet_models.pkl"
            weights_path = tmp_path / "ensemble_weights.json"
            with prophet_path.open("wb") as file_obj:
                pickle.dump(prophet_models, file_obj)
            with weights_path.open("w", encoding="utf-8") as file_obj:
                json.dump({sku: [w_p, w_l] for sku, (w_p, w_l) in weights_by_sku.items()}, file_obj, indent=2)
            mlflow.log_artifact(str(prophet_path))
            mlflow.log_artifact(str(weights_path))

        print(f"Core artifacts logged. Val RMSE: {val_rmse:.4f}. Val WRMSSE: {val_wrmsse:.4f}")

        # Backtest runs after artifacts are safe
        backtest_results: dict[str, dict] = {}
        for backtest_sku in skus[:5]:
            result = rolling_backtest(feature_df, backtest_sku, booster, prophet_models, weights_by_sku)
            if result:
                backtest_results[backtest_sku] = result
        backtest_scores = [
            result["avg_ensemble_rmse"]
            for result in backtest_results.values()
            if not np.isnan(float(result["avg_ensemble_rmse"]))
        ]
        backtest_avg_ensemble_rmse = float(np.mean(backtest_scores)) if backtest_scores else float("nan")
        mlflow.log_metric("backtest_avg_ensemble_rmse", backtest_avg_ensemble_rmse)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            backtest_path = tmp_path / "backtest_results.json"
            with backtest_path.open("w", encoding="utf-8") as file_obj:
                json.dump(backtest_results, file_obj, indent=2)
            mlflow.log_artifact(str(backtest_path))

        try:
            processed_dir = Path("data") / "processed"
            processed_dir.mkdir(parents=True, exist_ok=True)
            summary_path = processed_dir / "training_summary.parquet"
            trained_at = pd.Timestamp.utcnow().isoformat()
            summary_df = pd.DataFrame(
                [
                    {
                        "sku_id": sku_id,
                        "trained_at": trained_at,
                        "val_rmse": val_rmse,
                        "n_prophet_models": len(prophet_models),
                    }
                    for sku_id in prophet_models
                ]
            )
            summary_df.to_parquet(summary_path, index=False)
            mlflow.log_artifact(str(summary_path))
        except Exception:
            pass

        mlflow.log_param("status", "trained")
        print(f"Training complete. Val RMSE: {val_rmse:.4f}. Val WRMSSE: {val_wrmsse:.4f}")
        print(f"MLflow run ID: {run.info.run_id}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train retail demand forecasting models.")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic M5-shaped training data.")
    parser.add_argument("--n-skus", type=int, default=50, help="Number of synthetic item SKUs to generate.")
    parser.add_argument("--sku-sample", type=int, default=None, help="Random sample of SKU-store series to train.")
    args = parser.parse_args()
    main(use_synthetic=args.synthetic, n_synthetic_skus=args.n_skus, sku_sample=args.sku_sample)
