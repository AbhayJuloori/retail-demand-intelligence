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
from tqdm import tqdm

from ml.forecasting import blend, ensemble_weights, forecast_lightgbm, forecast_prophet, train_lightgbm, train_prophet
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
    feature_df = engineer_features(tidy_df)
    train_df, val_df = train_val_split(feature_df, val_days=28)

    skus = sorted(feature_df["sku_id"].unique().tolist())
    if sku_sample is not None:
        rng = np.random.default_rng(42)
        sample_size = min(sku_sample, len(skus))
        skus = sorted(rng.choice(skus, size=sample_size, replace=False).tolist())

    with mlflow.start_run() as run:
        mlflow.log_params(
            {
                "use_synthetic": use_synthetic,
                "n_skus": len(skus),
                "val_days": 28,
            }
        )

        booster = train_lightgbm(train_df)
        mlflow.log_params(
            {
                "lgbm_objective": "regression",
                "lgbm_num_leaves": 31,
                "lgbm_n_estimators": 200,
                "lgbm_learning_rate": 0.05,
                "lgbm_random_state": 42,
            }
        )

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
        else:
            val_rmse = float("nan")

        mlflow.log_metric("val_rmse", val_rmse)
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

        mlflow.log_param("status", "trained")
        print(f"Training complete. Val RMSE: {val_rmse:.4f}")
        print(f"MLflow run ID: {run.info.run_id}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train retail demand forecasting models.")
    parser.add_argument("--synthetic", action="store_true", help="Use synthetic M5-shaped training data.")
    parser.add_argument("--n-skus", type=int, default=50, help="Number of synthetic item SKUs to generate.")
    parser.add_argument("--sku-sample", type=int, default=None, help="Random sample of SKU-store series to train.")
    args = parser.parse_args()
    main(use_synthetic=args.synthetic, n_synthetic_skus=args.n_skus, sku_sample=args.sku_sample)
