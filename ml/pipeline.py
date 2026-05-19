"""Data loading, preprocessing, and feature engineering for M5 demand data."""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def load_m5_data(
    data_dir: str | Path = "data/raw",
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Load M5 sales, prices, and calendar CSVs from disk."""
    root = Path(data_dir)
    paths = {
        "sales": root / "sales_train_validation.csv",
        "prices": root / "sell_prices.csv",
        "calendar": root / "calendar.csv",
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        missing_files = ", ".join(missing)
        raise FileNotFoundError(
            "Missing M5 data files: "
            f"{missing_files}. Download the M5 Forecasting - Accuracy data from "
            "Kaggle and place sales_train_validation.csv, sell_prices.csv, and "
            "calendar.csv in data/raw."
        )

    sales_df = pd.read_csv(paths["sales"])
    prices_df = pd.read_csv(paths["prices"])
    calendar_df = pd.read_csv(paths["calendar"])
    return sales_df, prices_df, calendar_df


def make_synthetic_data(
    n_skus: int = 100,
    n_stores: int = 2,
    n_days: int = 365,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Generate synthetic M5-shaped data for development and CI."""
    rng = np.random.default_rng(42)
    start_date = pd.Timestamp("2011-01-29")
    dates = pd.date_range(start_date, periods=n_days, freq="D")
    state_cycle = ["CA", "TX", "WI"]
    store_ids = [f"{state_cycle[i % len(state_cycle)]}_{i + 1}" for i in range(n_stores)]
    item_ids = [f"FOODS_3_{i + 1:03d}" for i in range(n_skus)]

    calendar_rows: list[dict[str, object]] = []
    event_days = {
        31: "SuperBowl",
        95: "Easter",
        186: "IndependenceDay",
        330: "Thanksgiving",
        359: "Christmas",
    }
    for idx, date in enumerate(dates, start=1):
        iso = date.isocalendar()
        day_in_month = date.day
        calendar_rows.append(
            {
                "date": date.strftime("%Y-%m-%d"),
                "wm_yr_wk": int(iso.year * 100 + iso.week),
                "weekday": date.day_name(),
                "wday": int((date.dayofweek + 1) % 7 + 1),
                "month": int(date.month),
                "year": int(date.year),
                "d": f"d_{idx}",
                "event_name_1": event_days.get(idx),
                "event_type_1": "National" if idx in event_days else np.nan,
                "event_name_2": np.nan,
                "event_type_2": np.nan,
                "snap_CA": int(day_in_month in {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}),
                "snap_TX": int(day_in_month in {1, 3, 5, 7, 9, 11, 13, 15}),
                "snap_WI": int(day_in_month in {2, 4, 6, 8, 10, 12, 14, 16}),
            }
        )
    calendar_df = pd.DataFrame(calendar_rows)

    sales_rows: list[dict[str, object]] = []
    price_rows: list[dict[str, object]] = []
    weeks = calendar_df["wm_yr_wk"].drop_duplicates().tolist()
    calendar_lookup = calendar_df.set_index("d")

    for item_idx, item_id in enumerate(item_ids):
        dept_id = "FOODS_3"
        cat_id = "FOODS"
        base_demand = rng.uniform(4.0, 24.0)
        item_trend = rng.uniform(-0.002, 0.012)
        item_price = rng.uniform(1.5, 8.5)

        for store_idx, store_id in enumerate(store_ids):
            state_id = store_id.split("_", maxsplit=1)[0]
            store_multiplier = rng.uniform(0.75, 1.35)
            weekly_phase = rng.uniform(0.0, 2.0 * np.pi)
            row: dict[str, object] = {
                "id": f"{item_id}_{store_id}_validation",
                "item_id": item_id,
                "dept_id": dept_id,
                "cat_id": cat_id,
                "store_id": store_id,
                "state_id": state_id,
            }

            for week_idx, week in enumerate(weeks):
                price_noise = rng.normal(0.0, 0.03)
                price_rows.append(
                    {
                        "store_id": store_id,
                        "item_id": item_id,
                        "wm_yr_wk": int(week),
                        "sell_price": round(max(0.25, item_price * (1.0 + price_noise + week_idx * 0.0005)), 2),
                    }
                )

            for day_idx in range(1, n_days + 1):
                day_key = f"d_{day_idx}"
                day_meta = calendar_lookup.loc[day_key]
                date = pd.Timestamp(day_meta["date"])
                weekly = 1.0 + 0.22 * np.sin((2.0 * np.pi * date.dayofweek / 7.0) + weekly_phase)
                weekend_boost = 1.18 if date.dayofweek in {5, 6} else 1.0
                trend = 1.0 + item_trend * day_idx
                snap_flag = int(day_meta[f"snap_{state_id}"])
                snap_boost = 1.25 if snap_flag else 1.0
                event_boost = 1.35 if pd.notna(day_meta["event_name_1"]) else 1.0
                expected = base_demand * store_multiplier * weekly * weekend_boost * trend * snap_boost * event_boost
                noisy_expected = max(0.1, expected + rng.normal(0.0, max(1.0, expected * 0.12)))
                row[day_key] = int(rng.poisson(noisy_expected))

            sales_rows.append(row)

    sales_df = pd.DataFrame(sales_rows)
    prices_df = pd.DataFrame(price_rows)
    logger.info("Generated synthetic M5 data with %s rows and %s days", len(sales_df), n_days)
    return sales_df, prices_df, calendar_df


def preprocess(
    sales_df: pd.DataFrame,
    prices_df: pd.DataFrame,
    calendar_df: pd.DataFrame,
) -> pd.DataFrame:
    """Convert M5 wide sales data into a tidy modeling frame."""
    day_cols = [col for col in sales_df.columns if col.startswith("d_")]
    id_cols = [col for col in sales_df.columns if col not in day_cols]
    long_sales = sales_df.melt(
        id_vars=id_cols,
        value_vars=day_cols,
        var_name="d",
        value_name="sales",
    )

    calendar_cols = ["d", "date", "wm_yr_wk", "event_name_1", "snap_CA", "snap_TX", "snap_WI"]
    calendar = calendar_df[calendar_cols].copy()
    calendar["date"] = pd.to_datetime(calendar["date"])

    merged = long_sales.merge(calendar, on="d", how="left")
    merged = merged.merge(
        prices_df[["store_id", "item_id", "wm_yr_wk", "sell_price"]],
        on=["store_id", "item_id", "wm_yr_wk"],
        how="left",
    )
    merged["sku_id"] = merged["item_id"].astype(str) + "_" + merged["store_id"].astype(str)
    merged["d"] = merged["d"].str.removeprefix("d_").astype(int)
    merged = merged.sort_values(["sku_id", "date"]).reset_index(drop=True)
    merged["sell_price"] = merged.groupby("sku_id", sort=False)["sell_price"].ffill()
    merged["sell_price"] = merged["sell_price"].fillna(
        merged.groupby("sku_id", sort=False)["sell_price"].transform("median")
    )
    global_median_price = merged["sell_price"].median()
    merged["sell_price"] = merged["sell_price"].fillna(1.0 if pd.isna(global_median_price) else global_median_price)
    merged["sell_price"] = merged["sell_price"].astype(float)

    columns = [
        "item_id",
        "store_id",
        "sku_id",
        "date",
        "sales",
        "sell_price",
        "event_name_1",
        "snap_CA",
        "snap_TX",
        "snap_WI",
        "d",
    ]
    return merged[columns]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add lag, rolling, calendar, SNAP, and event features."""
    featured = df.copy()
    featured["date"] = pd.to_datetime(featured["date"])
    featured = featured.sort_values(["sku_id", "date"]).reset_index(drop=True)
    grouped = featured.groupby("sku_id", sort=False)["sales"]

    for lag in (7, 14, 28):
        featured[f"lag_{lag}"] = grouped.shift(lag)

    featured["rolling_mean_7"] = grouped.transform(lambda series: series.shift(1).rolling(7).mean())
    featured["rolling_mean_28"] = grouped.transform(lambda series: series.shift(1).rolling(28).mean())
    featured["day_of_week"] = featured["date"].dt.dayofweek
    featured["month"] = featured["date"].dt.month
    featured["week_of_year"] = featured["date"].dt.isocalendar().week.astype(int)
    featured["snap_flag"] = featured[["snap_CA", "snap_TX", "snap_WI"]].max(axis=1).astype(int)
    featured["has_event"] = featured["event_name_1"].notna().astype(int)

    return featured.dropna(subset=["lag_7", "lag_14", "lag_28", "rolling_mean_7", "rolling_mean_28"]).reset_index(
        drop=True
    )


def train_val_split(
    df: pd.DataFrame,
    val_days: int = 28,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split each SKU into train rows and the final validation days."""
    if val_days <= 0:
        raise ValueError("val_days must be positive")

    ordered = df.sort_values(["sku_id", "date"]).reset_index(drop=True)
    row_number = ordered.groupby("sku_id").cumcount()
    group_sizes = ordered.groupby("sku_id")["sku_id"].transform("size")
    is_val = row_number >= (group_sizes - val_days)
    train_df = ordered.loc[~is_val].reset_index(drop=True)
    val_df = ordered.loc[is_val].reset_index(drop=True)
    return train_df, val_df
