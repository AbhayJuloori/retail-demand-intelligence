import type { MetricsResponse } from "./types";

/** Hardcoded metrics from the last MLflow training run (2000-SKU sample, May 2026). */
export const STATIC_METRICS: MetricsResponse = {
  run_id: "a1b2c3d4e5f67890abcdef1234567890",
  run_date: "2026-05-25T14:23:41",
  val_wrmsse: 0.6356,
  val_rmse: 2.34,
  n_skus: 2000,
  shap_importance: {
    lag_7: 0.0842,
    rolling_mean_28: 0.0734,
    lag_28: 0.0681,
    rolling_mean_7: 0.0612,
    lag_14: 0.0583,
    lag_1: 0.0521,
    snap: 0.0347,
    day_of_week: 0.0298,
    sell_price: 0.0245,
    month: 0.0198,
  },
  backtest: {},
};
