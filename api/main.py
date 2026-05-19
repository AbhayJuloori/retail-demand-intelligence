"""FastAPI app for retail demand intelligence."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import mlflow

    from ml.predict import load_artifacts
    from ml.predict import predict as ml_predict
    from ml.inventory import compute_inventory_state

    ML_AVAILABLE = True
except Exception as e:
    mlflow = None
    ML_AVAILABLE = False
    _ML_ERROR = str(e)

from api.llm_client import LLMClient

app = FastAPI(title="Retail Demand Intelligence API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_llm_client = LLMClient()


@app.get("/health")
def health():
    return {"status": "ok", "ml_available": ML_AVAILABLE, "llm_provider": _llm_client.provider}


def _latest_run_id() -> str:
    if mlflow is None:
        raise ValueError("MLflow is not available")
    runs = mlflow.search_runs(
        experiment_names=["retail-demand-intelligence"],
        filter_string="attributes.status = 'FINISHED'",
        order_by=["attributes.start_time DESC"],
        max_results=1,
    )
    if runs.empty:
        raise ValueError("No successful MLflow runs found")
    return str(runs.iloc[0]["run_id"])


def _download_json_artifact(client, run_id: str, artifact_path: str) -> dict:
    try:
        local_path = client.download_artifacts(run_id, artifact_path)
        with open(local_path, "r", encoding="utf-8") as file_obj:
            return json.load(file_obj)
    except Exception:
        return {}


@app.get("/metrics")
def metrics(run_id: Optional[str] = None):
    if not ML_AVAILABLE:
        raise HTTPException(503, detail=f"ML layer not available: {_ML_ERROR}")

    try:
        resolved_run_id = run_id or _latest_run_id()
        _booster, prophet_models, _ensemble_weights = load_artifacts(run_id=resolved_run_id)
        client = mlflow.tracking.MlflowClient()
        run = client.get_run(resolved_run_id)
    except Exception as e:
        raise HTTPException(503, detail=f"Could not load ML metrics: {e}") from e

    run_date = ""
    if run.info.start_time is not None:
        run_date = datetime.fromtimestamp(run.info.start_time / 1000, tz=timezone.utc).isoformat()

    run_metrics = run.data.metrics
    val_rmse = run_metrics.get("val_rmse")
    val_wrmsse = run_metrics.get("val_wrmsse")

    return {
        "run_id": resolved_run_id,
        "run_date": run_date,
        "val_rmse": float(val_rmse) if val_rmse is not None else None,
        "val_wrmsse": float(val_wrmsse) if val_wrmsse is not None else None,
        "backtest": _download_json_artifact(client, resolved_run_id, "backtest_results.json"),
        "shap_importance": _download_json_artifact(client, resolved_run_id, "shap_importance.json"),
        "n_skus": len(prophet_models),
    }


@app.get("/forecast/{sku_id}")
def forecast(sku_id: str, horizon: int = 28, current_stock: Optional[float] = None, run_id: Optional[str] = None):
    if not ML_AVAILABLE:
        raise HTTPException(503, detail=f"ML layer not available: {_ML_ERROR}")
    try:
        result = ml_predict(sku_id=sku_id, horizon=horizon, run_id=run_id, current_stock=current_stock)
    except Exception as e:
        raise HTTPException(503, detail=f"Could not generate forecast: {e}") from e
    if "error" in result:
        raise HTTPException(404, detail=result["error"])
    return result


@app.get("/inventory")
def inventory_summary(run_id: Optional[str] = None, limit: int = 100):
    if not ML_AVAILABLE:
        raise HTTPException(503, detail=f"ML layer not available: {_ML_ERROR}")
    try:
        artifacts = load_artifacts(run_id=run_id)
        booster, prophet_models, ensemble_weights = artifacts
    except Exception as e:
        raise HTTPException(503, detail=f"Could not load ML artifacts: {e}") from e

    skus = list(prophet_models.keys())[:limit]
    results = []
    for sku_id in skus:
        try:
            fc = ml_predict(sku_id=sku_id, horizon=28, run_id=run_id, current_stock=100.0)
            inv = fc.get("inventory_state", {})
            results.append({"sku_id": sku_id, **inv})
        except Exception:
            pass
    results.sort(key=lambda x: x.get("days_until_stockout", 999))
    return {"skus": results, "total": len(results)}


class InsightRequest(BaseModel):
    sku_id: str
    status: str = "UNKNOWN"
    days_until_stockout: int = 999
    avg_daily_demand: float = 0.0
    recommended_order_qty: float = 0.0
    trigger_date: str = ""
    top_shap_features: list[str] = []


@app.post("/insights")
def generate_insight(body: InsightRequest, x_llm_key: Optional[str] = Header(default=None)):
    try:
        insight = _llm_client.generate_insight(body.model_dump(), api_key=x_llm_key)
    except Exception as e:
        raise HTTPException(502, detail=f"Could not generate insight: {e}") from e
    return {"sku_id": body.sku_id, "insight": insight, "provider": _llm_client.provider}


@app.post("/insights/refresh")
def refresh_insights(run_id: Optional[str] = None, limit: int = 100, x_llm_key: Optional[str] = Header(default=None)):
    if not ML_AVAILABLE:
        raise HTTPException(503, detail=f"ML layer not available: {_ML_ERROR}")
    try:
        artifacts = load_artifacts(run_id=run_id)
        booster, prophet_models, ensemble_weights = artifacts
    except Exception as e:
        raise HTTPException(503, detail=f"Could not load ML artifacts: {e}") from e

    skus = list(prophet_models.keys())[:limit]
    insights = []
    for sku_id in skus:
        try:
            fc = ml_predict(sku_id=sku_id, horizon=28, run_id=run_id, current_stock=100.0)
            inv = fc.get("inventory_state", {})
            sku_data = {"sku_id": sku_id, **inv}
            text = _llm_client.generate_insight(sku_data, api_key=x_llm_key)
            insights.append({"sku_id": sku_id, "insight": text})
        except Exception as e:
            insights.append({"sku_id": sku_id, "error": str(e)})
    return {"insights": insights, "count": len(insights)}
