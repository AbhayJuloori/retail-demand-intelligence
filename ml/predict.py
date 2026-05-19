"""Prediction helpers for MLflow-backed demand forecasts."""

from __future__ import annotations

import json
import logging
import pickle
from datetime import datetime
from typing import Any

import mlflow
import mlflow.lightgbm
import numpy as np
import pandas as pd
from mlflow.tracking import MlflowClient

from ml.forecasting import blend, forecast_lightgbm, forecast_prophet
from ml.inventory import compute_inventory_state

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[object, dict[str, Any], dict[str, tuple[float, float]]]] = {}


def _latest_successful_run_id(experiment_name: str) -> str:
    client = MlflowClient()
    experiment = client.get_experiment_by_name(experiment_name)
    if experiment is None:
        raise ValueError(f"MLflow experiment not found: {experiment_name}")

    runs = client.search_runs(
        [experiment.experiment_id],
        filter_string="attributes.status = 'FINISHED'",
        order_by=["attributes.start_time DESC"],
        max_results=1,
    )
    if not runs:
        raise ValueError(f"No successful MLflow runs found for experiment: {experiment_name}")
    return runs[0].info.run_id


def load_artifacts(
    run_id: str | None = None,
) -> tuple[object, dict[str, Any], dict[str, tuple[float, float]]]:
    """Load LightGBM, Prophet, and ensemble weight artifacts from MLflow."""
    resolved_run_id = run_id or _latest_successful_run_id("retail-demand-intelligence")
    if resolved_run_id in _cache:
        return _cache[resolved_run_id]

    client = MlflowClient()
    booster = mlflow.lightgbm.load_model(f"runs:/{resolved_run_id}/lightgbm_model")

    prophet_path = client.download_artifacts(resolved_run_id, "prophet_models.pkl")
    weights_path = client.download_artifacts(resolved_run_id, "ensemble_weights.json")
    with open(prophet_path, "rb") as file_obj:
        prophet_models = pickle.load(file_obj)
    with open(weights_path, "r", encoding="utf-8") as file_obj:
        raw_weights = json.load(file_obj)

    weights = {sku: (float(values[0]), float(values[1])) for sku, values in raw_weights.items()}
    artifacts = (booster, prophet_models, weights)
    _cache[resolved_run_id] = artifacts
    return artifacts


def _future_lightgbm_features(model: Any, forecast_df: pd.DataFrame) -> pd.DataFrame:
    history = [float(value) for value in model.history["y"].to_numpy()]
    rows: list[dict[str, float | int]] = []

    for _, forecast_row in forecast_df.iterrows():
        current_history = history if history else [0.0]
        date = pd.Timestamp(forecast_row["ds"])
        fallback = float(np.mean(current_history[-28:]))

        def lag_value(lag: int) -> float:
            return current_history[-lag] if len(current_history) >= lag else fallback

        row = {
            "lag_7": lag_value(7),
            "lag_14": lag_value(14),
            "lag_28": lag_value(28),
            "rolling_mean_7": float(np.mean(current_history[-7:])),
            "rolling_mean_28": float(np.mean(current_history[-28:])),
            "day_of_week": int(date.dayofweek),
            "month": int(date.month),
            "week_of_year": int(date.isocalendar().week),
            "snap_flag": 0,
            "has_event": 0,
            "sell_price": 1.0,
        }
        rows.append(row)
        history.append(max(0.0, float(forecast_row["yhat"])))

    return pd.DataFrame(rows)


def predict(
    sku_id: str,
    horizon: int = 28,
    run_id: str | None = None,
    current_stock: float | None = None,
) -> dict[str, object]:
    """Generate a blended forecast for one SKU."""
    resolved_run_id = run_id or _latest_successful_run_id("retail-demand-intelligence")
    booster, prophet_models, weights = load_artifacts(resolved_run_id)
    if sku_id not in prophet_models:
        return {"error": "SKU not trained"}

    prophet_model = prophet_models[sku_id]
    forecast_df = forecast_prophet(prophet_model, horizon)
    future_features_df = _future_lightgbm_features(prophet_model, forecast_df)
    lgbm_preds = forecast_lightgbm(booster, future_features_df)
    w_prophet, w_lightgbm = weights.get(sku_id, (0.5, 0.5))
    blended = blend(forecast_df["yhat"].to_numpy(), lgbm_preds, w_prophet, w_lightgbm)

    forecast_rows = []
    for idx, row in forecast_df.reset_index(drop=True).iterrows():
        ds = pd.Timestamp(row["ds"]).date().isoformat()
        forecast_rows.append(
            {
                "date": ds,
                "yhat": float(row["yhat"]),
                "yhat_lower": float(row["yhat_lower"]),
                "yhat_upper": float(row["yhat_upper"]),
                "blended": float(blended[idx]),
            }
        )

    result: dict[str, object] = {
        "sku_id": sku_id,
        "horizon": horizon,
        "forecast": forecast_rows,
        "run_id": resolved_run_id,
        "w_prophet": w_prophet,
        "w_lightgbm": w_lightgbm,
    }
    if current_stock is not None:
        result["inventory_state"] = compute_inventory_state(sku_id, current_stock, forecast_df)

    logger.info("Generated %s-day forecast for %s from run %s at %s", horizon, sku_id, resolved_run_id, datetime.now())
    return result
