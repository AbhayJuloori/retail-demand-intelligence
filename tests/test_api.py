"""Smoke tests for FastAPI routes — no ML dependencies required."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient


def _make_client(ml_available: bool = False):
    import api.main as main_module

    main_module.ML_AVAILABLE = ml_available
    if not ml_available:
        main_module._ML_ERROR = "test: ML layer disabled"
    return TestClient(main_module.app)


def test_health_returns_200():
    client = _make_client(ml_available=False)
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] == "ok"
    assert "ml_available" in data


def test_health_reports_ml_unavailable():
    client = _make_client(ml_available=False)
    resp = client.get("/health")
    assert resp.json()["ml_available"] is False


def test_metrics_503_when_ml_unavailable():
    client = _make_client(ml_available=False)
    resp = client.get("/metrics")
    assert resp.status_code == 503


def test_forecast_503_when_ml_unavailable():
    client = _make_client(ml_available=False)
    resp = client.get("/forecast/FOODS_1_001_CA_1")
    assert resp.status_code == 503


def test_forecast_rejects_invalid_horizon():
    client = _make_client(ml_available=True)
    with patch("api.main.ml_predict") as mock_pred:
        resp = client.get("/forecast/FOODS_1_001_CA_1?horizon=0")
        assert resp.status_code == 400
        resp = client.get("/forecast/FOODS_1_001_CA_1?horizon=91")
        assert resp.status_code == 400


def test_inventory_503_when_ml_unavailable():
    client = _make_client(ml_available=False)
    resp = client.get("/inventory")
    assert resp.status_code == 503


def test_inventory_rejects_invalid_limit():
    client = _make_client(ml_available=True)
    with patch("api.main.load_artifacts") as mock_arts:
        mock_arts.return_value = (MagicMock(), {}, {})
        resp = client.get("/inventory?limit=0")
        assert resp.status_code == 400
        resp = client.get("/inventory?limit=501")
        assert resp.status_code == 400


def test_insights_calls_llm():
    client = _make_client(ml_available=False)
    payload = {
        "sku_id": "FOODS_1_001_CA_1",
        "status": "OK",
        "days_until_stockout": 30,
        "avg_daily_demand": 5.0,
        "recommended_order_qty": 0.0,
        "trigger_date": "2026-06-01",
        "top_shap_features": ["lag_7", "rolling_mean_28"],
    }
    with patch.object(client.app.state, "__dict__", {}, create=True):
        import api.main as main_module

        with patch.object(main_module._llm_client, "generate_insight", return_value="test insight") as mock_llm:
            resp = client.post("/insights", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["sku_id"] == "FOODS_1_001_CA_1"
            assert data["insight"] == "test insight"
            mock_llm.assert_called_once()


if __name__ == "__main__":
    tests = [
        test_health_returns_200,
        test_health_reports_ml_unavailable,
        test_metrics_503_when_ml_unavailable,
        test_forecast_503_when_ml_unavailable,
        test_forecast_rejects_invalid_horizon,
        test_inventory_503_when_ml_unavailable,
        test_inventory_rejects_invalid_limit,
        test_insights_calls_llm,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"PASS {t.__name__}")
            passed += 1
        except Exception as exc:
            print(f"FAIL {t.__name__}: {exc}")
    print(f"\n{passed}/{len(tests)} passed")
    if passed != len(tests):
        raise SystemExit(1)
