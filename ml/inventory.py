"""Inventory optimization formulas."""

from __future__ import annotations

import math
from datetime import date, timedelta

import pandas as pd


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
        "status": status,
        "recommended_order_qty": max(0.0, eq - current_stock),
        "trigger_date": trigger_date.isoformat(),
    }
