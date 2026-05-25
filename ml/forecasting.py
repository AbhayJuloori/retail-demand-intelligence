"""Forecasting models and ensemble utilities."""

from __future__ import annotations

import inspect
import logging
from typing import Any

import lightgbm as lgb
import numpy as np
import pandas as pd

try:
    from prophet import Prophet
except ImportError as exc:
    Prophet = None
    _PROPHET_IMPORT_ERROR = exc
else:
    _PROPHET_IMPORT_ERROR = None

logger = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "lag_1",
    "lag_3",
    "lag_7",
    "lag_14",
    "lag_28",
    "lag_56",
    "lag_364",
    "rolling_mean_7",
    "rolling_mean_28",
    "rolling_std_7",
    "rolling_std_28",
    "store_rolling_mean_7",
    "store_rolling_mean_28",
    "day_of_week",
    "month",
    "week_of_year",
    "dept_id",
    "cat_id",
    "state_id",
    "snap_flag",
    "has_event",
    "event_cultural",
    "event_national",
    "event_religious",
    "event_sporting",
    "sell_price",
    "price_momentum",
    "price_change_flag",
]

LIGHTGBM_NUM_BOOST_ROUND = 500
LIGHTGBM_EARLY_STOPPING_ROUNDS = 100
LIGHTGBM_VALIDATION_DAYS = 28


def train_prophet(train_df: pd.DataFrame, sku_id: str) -> Any | None:
    """Train a Prophet model for one SKU."""
    if Prophet is None:
        raise ImportError("Prophet is required for train_prophet. Install prophet to train forecasting models.") from (
            _PROPHET_IMPORT_ERROR
        )

    sku_df = train_df.loc[train_df["sku_id"] == sku_id, ["date", "sales"]].copy()
    sku_df = sku_df.rename(columns={"date": "ds", "sales": "y"}).sort_values("ds")
    sku_df["ds"] = pd.to_datetime(sku_df["ds"])
    if len(sku_df) < 30:
        logger.warning("Skipping Prophet for %s: fewer than 30 data points", sku_id)
        return None

    model = Prophet(weekly_seasonality=True, yearly_seasonality=True, daily_seasonality=False)
    model.add_country_holidays(country_name="US")
    model.fit(sku_df)
    return model


def forecast_prophet(model: Any, horizon: int = 28) -> pd.DataFrame:
    """Forecast future demand with a fitted Prophet model."""
    future = model.make_future_dataframe(periods=horizon, freq="D", include_history=False)
    forecast = model.predict(future)
    return forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]]


def train_lightgbm(train_df: pd.DataFrame) -> lgb.Booster:
    """Train a LightGBM regressor on engineered cross-SKU features."""
    model_df = train_df.dropna(subset=FEATURE_COLUMNS + ["sales"]).copy()
    model_df["date"] = pd.to_datetime(model_df["date"])

    validation_dates = model_df["date"].dropna().sort_values().unique()[-LIGHTGBM_VALIDATION_DAYS:]
    is_validation = model_df["date"].isin(validation_dates)
    train_model_df = model_df.loc[~is_validation]
    valid_model_df = model_df.loc[is_validation]
    use_early_stopping = False
    train_model_df = model_df

    categorical_features = ["dept_id", "cat_id", "state_id"]
    dataset = lgb.Dataset(
        train_model_df[FEATURE_COLUMNS],
        label=train_model_df["sales"],
        categorical_feature=categorical_features,
    )
    params = {
        "objective": "tweedie",
        "tweedie_variance_power": 1.5,
        "metric": "tweedie",
        "num_leaves": 31,
        "learning_rate": 0.05,
        "verbose": -1,
    }
    train_kwargs: dict[str, Any] = {"num_boost_round": LIGHTGBM_NUM_BOOST_ROUND}
    if use_early_stopping:
        validation_dataset = lgb.Dataset(
            valid_model_df[FEATURE_COLUMNS],
            label=valid_model_df["sales"],
            categorical_feature=categorical_features,
            reference=dataset,
        )
        train_kwargs.update(
            {
                "valid_sets": [validation_dataset],
                "valid_names": ["lgb_validation"],
                "callbacks": [lgb.early_stopping(LIGHTGBM_EARLY_STOPPING_ROUNDS, verbose=False)],
            }
        )
    if "categorical_feature" in inspect.signature(lgb.train).parameters:
        train_kwargs["categorical_feature"] = categorical_features
    return lgb.train(params, dataset, **train_kwargs)


def forecast_lightgbm(booster: lgb.Booster, val_df: pd.DataFrame) -> np.ndarray:
    """Forecast demand with a trained LightGBM booster."""
    preds = booster.predict(val_df[FEATURE_COLUMNS])
    return np.clip(np.asarray(preds, dtype=float), 0.0, None)


def ensemble_weights(
    prophet_preds: np.ndarray | pd.Series | list[float],
    lgbm_preds: np.ndarray | pd.Series | list[float],
    actuals: np.ndarray | pd.Series | list[float],
) -> tuple[float, float]:
    """Find validation weights minimizing simplified uniform WRMSSE."""
    prophet_arr = np.asarray(prophet_preds, dtype=float)
    lgbm_arr = np.asarray(lgbm_preds, dtype=float)
    actual_arr = np.asarray(actuals, dtype=float)

    best_weight = 0.0
    best_score = float("inf")
    for w_prophet in np.linspace(0.0, 1.0, 11):
        w_lightgbm = 1.0 - w_prophet
        blended = (w_prophet * prophet_arr) + (w_lightgbm * lgbm_arr)
        score = float(np.sqrt(np.mean((actual_arr - blended) ** 2)))
        if score < best_score:
            best_score = score
            best_weight = float(w_prophet)

    return best_weight, 1.0 - best_weight


def blend(
    prophet_preds: np.ndarray | pd.Series | list[float],
    lgbm_preds: np.ndarray | pd.Series | list[float],
    w_p: float,
    w_l: float,
) -> np.ndarray:
    """Blend Prophet and LightGBM forecasts."""
    blended = (w_p * np.asarray(prophet_preds, dtype=float)) + (w_l * np.asarray(lgbm_preds, dtype=float))
    return np.clip(blended, 0.0, None)


def wrmsse(actual: pd.Series, predicted: pd.Series, scale: float, weight: float = 1.0) -> float:
    """Calculate weighted root mean squared scaled error."""
    actual_arr = actual.to_numpy(dtype=float)
    predicted_arr = predicted.to_numpy(dtype=float)
    valid = ~(np.isnan(actual_arr) | np.isnan(predicted_arr))
    if not valid.any():
        return float("nan")

    mse = float(np.mean((actual_arr[valid] - predicted_arr[valid]) ** 2))
    if scale <= 0 or np.isnan(scale):
        return 0.0 if mse == 0 else float("inf")
    return float(np.sqrt(mse / scale) * weight)


def rolling_backtest(
    df: pd.DataFrame,
    sku_id: str,
    booster,
    prophet_models: dict,
    ensemble_weights: dict,
    n_windows: int = 3,
    window_days: int = 28,
) -> dict:
    """Run rolling validation windows for one SKU."""
    del booster, prophet_models

    ordered = df.copy()
    ordered["date"] = pd.to_datetime(ordered["date"])
    ordered = ordered.sort_values(["sku_id", "date"]).reset_index(drop=True)
    sku_df = ordered.loc[ordered["sku_id"] == sku_id].sort_values("date")
    if sku_df.empty:
        return {}

    max_date = sku_df["date"].max()
    results: dict[str, dict[str, float] | float] = {}
    prophet_scores: list[float] = []
    lgbm_scores: list[float] = []
    ensemble_scores: list[float] = []

    lookback_days = max(90, n_windows * window_days)
    step_days = 0.0 if n_windows == 1 else (lookback_days - window_days) / (n_windows - 1)

    for window_idx in range(n_windows):
        offset_days = round(lookback_days - window_days - (window_idx * step_days))
        window_start = max_date - pd.Timedelta(days=offset_days)
        window_end = window_start + pd.Timedelta(days=window_days - 1)

        train_window = ordered.loc[ordered["date"] < window_start]
        sku_holdout = sku_df.loc[(sku_df["date"] >= window_start) & (sku_df["date"] <= window_end)].sort_values("date")
        if train_window.empty or sku_holdout.empty:
            window_result = {
                "prophet_rmse": float("nan"),
                "lgbm_rmse": float("nan"),
                "ensemble_rmse": float("nan"),
            }
            results[f"window_{window_idx}"] = window_result
            continue

        window_booster = train_lightgbm(train_window)
        lgbm_preds = forecast_lightgbm(window_booster, sku_holdout)
        prophet_model = train_prophet(train_window, sku_id)
        if prophet_model is None:
            prophet_preds = np.zeros(len(sku_holdout), dtype=float)
            prophet_rmse = float("nan")
            w_prophet, w_lightgbm = 0.0, 1.0
        else:
            prophet_forecast = forecast_prophet(prophet_model, horizon=len(sku_holdout))
            prophet_preds = prophet_forecast["yhat"].to_numpy(dtype=float)
            prophet_rmse = float(np.sqrt(np.mean((sku_holdout["sales"].to_numpy(dtype=float) - prophet_preds) ** 2)))
            w_prophet, w_lightgbm = ensemble_weights.get(sku_id, (0.5, 0.5))

        ensemble_preds = blend(prophet_preds, lgbm_preds, float(w_prophet), float(w_lightgbm))
        actuals = sku_holdout["sales"].to_numpy(dtype=float)
        lgbm_rmse = float(np.sqrt(np.mean((actuals - lgbm_preds) ** 2)))
        ensemble_rmse = float(np.sqrt(np.mean((actuals - ensemble_preds) ** 2)))

        window_result = {
            "prophet_rmse": prophet_rmse,
            "lgbm_rmse": lgbm_rmse,
            "ensemble_rmse": ensemble_rmse,
        }
        results[f"window_{window_idx}"] = window_result
        prophet_scores.append(prophet_rmse)
        lgbm_scores.append(lgbm_rmse)
        ensemble_scores.append(ensemble_rmse)

    def mean_score(scores: list[float]) -> float:
        score_array = np.asarray(scores, dtype=float)
        score_array = score_array[~np.isnan(score_array)]
        return float(np.mean(score_array)) if len(score_array) else float("nan")

    results["avg_prophet_rmse"] = mean_score(prophet_scores)
    results["avg_lgbm_rmse"] = mean_score(lgbm_scores)
    results["avg_ensemble_rmse"] = mean_score(ensemble_scores)
    return results
