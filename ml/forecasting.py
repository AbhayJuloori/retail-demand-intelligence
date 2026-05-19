"""Forecasting models and ensemble utilities."""

from __future__ import annotations

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
    "lag_7",
    "lag_14",
    "lag_28",
    "rolling_mean_7",
    "rolling_mean_28",
    "day_of_week",
    "month",
    "week_of_year",
    "snap_flag",
    "has_event",
    "sell_price",
]


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
    dataset = lgb.Dataset(model_df[FEATURE_COLUMNS], label=model_df["sales"])
    params = {
        "objective": "regression",
        "metric": "rmse",
        "num_leaves": 31,
        "n_estimators": 200,
        "learning_rate": 0.05,
        "random_state": 42,
        "verbosity": -1,
    }
    return lgb.train(params, dataset, num_boost_round=200)


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
