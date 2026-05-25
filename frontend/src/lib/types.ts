export interface InventorySKU {
  sku_id: string;
  status: string;
  days_until_stockout: number;
  avg_daily_demand: number;
  current_stock: number;
  safety_stock: number;
  reorder_point: number;
  eoq: number;
  stockout_risk_score: number;
  recommended_order_qty: number;
  trigger_date: string;
}

export interface ForecastRow {
  date: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  blended: number;
}

export interface ForecastResponse {
  sku_id: string;
  forecast: ForecastRow[];
  inventory_state?: InventorySKU;
  w_prophet: number;
  w_lightgbm: number;
  top_3_features: string[];
}

export interface MetricsResponse {
  run_id: string;
  run_date: string;
  val_rmse: number | null;
  val_wrmsse: number | null;
  n_skus: number;
  shap_importance: Record<string, number>;
  backtest: Record<string, unknown>;
}

export interface InventoryResponse {
  skus: InventorySKU[];
  total: number;
}

export interface InsightResponse {
  sku_id: string;
  insight: string;
  provider: string;
}
