"""Inventory optimization formulas."""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd

_INV_CONFIG: dict | None = None
_CONFIG_PATH = Path(__file__).parent.parent / "config" / "inventory_params.json"


def _load_config() -> dict:
    global _INV_CONFIG
    if _INV_CONFIG is None:
        try:
            _INV_CONFIG = json.loads(_CONFIG_PATH.read_text())
        except Exception:
            _INV_CONFIG = {}
    return _INV_CONFIG


def _params_for_sku(sku_id: str) -> dict:
    config = _load_config()
    category = sku_id.split("_")[0] if "_" in sku_id else ""
    return config.get(category) or config.get("default") or {}


def reorder_point(avg_daily_demand: float, lead_time_days: int, safety_stock_units: float) -> float:
    """Calculate reorder point."""
    return avg_daily_demand * lead_time_days + safety_stock_units


def safety_stock(z_score: float, forecast_uncertainty_std: float, lead_time_days: int) -> float:
    """Calculate safety stock from forecast uncertainty."""
    return z_score * forecast_uncertainty_std * math.sqrt(lead_time_days)


def eoq(demand: float, order_cost: float, holding_cost: float) -> float:
    """Calculate economic order quantity."""
    return math.sqrt(2 * demand * order_cost / holding_cost) if holding_cost > 0 else 0.0


def classify_status(days_until_stockout: int, safety_stock_days: float) -> str:
    """Classify inventory risk status."""
    if days_until_stockout <= safety_stock_days:
        return "STOCKOUT IMMINENT"
    if days_until_stockout <= safety_stock_days * 2:
        return "AT RISK"
    return "OK"


def stockout_risk_score(days_until_stockout: int, lead_time_days: int = 7) -> float:
    """Returns 0.0-1.0 risk score. 1.0 = stockout imminent, 0.0 = safe."""
    if days_until_stockout <= 0:
        return 1.0
    if days_until_stockout <= lead_time_days:
        return 0.8

    medium_risk_days = lead_time_days * 3
    if days_until_stockout <= medium_risk_days:
        span = medium_risk_days - lead_time_days
        return 0.8 - ((days_until_stockout - lead_time_days) / span) * 0.5

    if days_until_stockout >= 90:
        return 0.0
    span = 90 - medium_risk_days
    return 0.3 - ((days_until_stockout - medium_risk_days) / span) * 0.3


def compute_inventory_state(
    sku_id: str,
    current_stock: float,
    forecast_df: pd.DataFrame,
    lead_time_days: int = 7,
    z_score: float = 1.65,
    order_cost: float = 50.0,
    holding_cost_rate: float = 0.25,
    avg_unit_price: float = 5.0,
) -> dict[str, float | int | str]:
    p = _params_for_sku(sku_id)
    lead_time_days = p.get("lead_time_days", lead_time_days)
    z_score = p.get("service_level_z", z_score)
    order_cost = p.get("order_cost", order_cost)
    holding_cost_rate = p.get("holding_cost_pct", holding_cost_rate)
    avg_unit_price = p.get("unit_price", avg_unit_price)
    """Compute inventory state and replenishment recommendation for a SKU."""
    avg_daily_demand = float(forecast_df["yhat"].mean())
    uncertainty_width = forecast_df["yhat_upper"] - forecast_df["yhat_lower"]
    forecast_uncertainty_std = float(uncertainty_width.std() / (2 * 1.65))
    if math.isnan(forecast_uncertainty_std):
        forecast_uncertainty_std = 0.0

    ss = safety_stock(z_score, forecast_uncertainty_std, lead_time_days)
    rop = reorder_point(avg_daily_demand, lead_time_days, ss)
    eq = eoq(avg_daily_demand * 365, order_cost, holding_cost_rate * avg_unit_price)
    days_until_stockout = int(current_stock / avg_daily_demand) if avg_daily_demand > 0 else 999
    safety_stock_days = ss / avg_daily_demand if avg_daily_demand > 0 else 0
    status = classify_status(days_until_stockout, safety_stock_days)
    trigger_date = date.today() + timedelta(days=max(0, days_until_stockout - lead_time_days))

    return {
        "sku_id": sku_id,
        "current_stock": float(current_stock),
        "avg_daily_demand": avg_daily_demand,
        "forecast_uncertainty_std": forecast_uncertainty_std,
        "safety_stock": ss,
        "reorder_point": rop,
        "eoq": eq,
        "days_until_stockout": days_until_stockout,
        "stockout_risk_score": stockout_risk_score(days_until_stockout, lead_time_days),
        "status": status,
        "recommended_order_qty": max(0.0, eq - current_stock),
        "trigger_date": trigger_date.isoformat(),
    }
