from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.inventory import eoq, reorder_point, safety_stock, stockout_risk_score

try:
    from ml.inventory import compute_inventory_state
except ImportError:
    compute_inventory_state = None


def test_rop_basic() -> None:
    assert reorder_point(10, 7, 20) == 90.0


def test_safety_stock() -> None:
    assert math.isclose(safety_stock(1.65, 5, 7), 21.85, abs_tol=0.05)


def test_eoq_basic() -> None:
    assert math.isclose(eoq(1000, 50, 2), 223.6, abs_tol=0.1)


def test_stockout_risk_imminent() -> None:
    assert stockout_risk_score(0) == 1.0


def test_stockout_risk_safe() -> None:
    assert stockout_risk_score(90) == 0.0


def smoke_compute_inventory_state() -> None:
    if compute_inventory_state is None:
        return

    try:
        import pandas as pd
    except ImportError:
        return

    forecast_df = pd.DataFrame(
        {
            "yhat": [10.0, 12.0, 11.0],
            "yhat_upper": [13.0, 15.0, 14.0],
            "yhat_lower": [7.0, 9.0, 8.0],
        }
    )
    compute_inventory_state("SKU-1", 100.0, forecast_df)


def run_test(test_func) -> bool:
    try:
        test_func()
    except Exception as exc:
        print(f"FAIL {test_func.__name__}: {exc}")
        return False

    print(f"PASS {test_func.__name__}")
    return True


if __name__ == "__main__":
    tests = [
        test_rop_basic,
        test_safety_stock,
        test_eoq_basic,
        test_stockout_risk_imminent,
        test_stockout_risk_safe,
        smoke_compute_inventory_state,
    ]
    passed = sum(run_test(test_func) for test_func in tests)
    if passed != len(tests):
        raise SystemExit(1)
