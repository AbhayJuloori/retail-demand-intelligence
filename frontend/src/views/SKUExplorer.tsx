"use client";

import { useMemo, useState } from "react";
import ForecastChart, { type ForecastPoint } from "../components/ForecastChart";
import InventoryTable, { type SKU } from "../components/InventoryTable";
import StatusBadge from "../components/StatusBadge";

const explorerSkus: SKU[] = [
  { sku_id: "FOODS-3-090-CA-1", status: "STOCKOUT IMMINENT", days_until_stockout: 2, recommended_order_qty: 420, trigger_date: "2026-05-21" },
  { sku_id: "HOUSE-1-224-TX-2", status: "AT RISK", days_until_stockout: 5, recommended_order_qty: 180, trigger_date: "2026-05-24" },
  { sku_id: "HOBBIES-2-048-WI-1", status: "AT RISK", days_until_stockout: 7, recommended_order_qty: 96, trigger_date: "2026-05-26" },
  { sku_id: "FOODS-2-312-CA-3", status: "AT RISK", days_until_stockout: 9, recommended_order_qty: 260, trigger_date: "2026-05-28" },
  { sku_id: "HOUSE-2-110-WI-2", status: "OK", days_until_stockout: 18, recommended_order_qty: 140, trigger_date: "2026-06-06" },
  { sku_id: "HOBBIES-1-777-TX-1", status: "OK", days_until_stockout: 21, recommended_order_qty: 80, trigger_date: "2026-06-09" },
  { sku_id: "FOODS-1-029-WI-3", status: "OK", days_until_stockout: 24, recommended_order_qty: 310, trigger_date: "2026-06-12" },
  { sku_id: "HOUSE-3-450-CA-2", status: "OK", days_until_stockout: 30, recommended_order_qty: 60, trigger_date: "2026-06-18" },
];

const forecastData: ForecastPoint[] = Array.from({ length: 28 }, (_, index) => {
  const yhat = 72 + Math.round(Math.sin(index / 3) * 8) + index;
  const actual = index < 14 ? yhat + Math.round(Math.cos(index / 2) * 5) : undefined;

  return {
    date: `D+${index + 1}`,
    actual,
    yhat,
    yhat_lower: yhat - 9,
    yhat_upper: yhat + 11,
  };
});

export default function SKUExplorer() {
  const [search, setSearch] = useState("");
  const [selectedSKU, setSelectedSKU] = useState<SKU | null>(explorerSkus[0]);

  const filteredSkus = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return explorerSkus;
    }

    return explorerSkus.filter((sku) => sku.sku_id.toLowerCase().includes(query));
  }, [search]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="space-y-5">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-amber">SKU Explorer</p>
          <h1 className="mt-2 text-4xl font-black lg:text-6xl">Inventory Risk Drilldown</h1>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search SKU ID"
          className="w-full rounded-2xl border border-navy/15 bg-cream px-5 py-4 text-base font-bold outline-none transition focus:border-navy focus:ring-4 focus:ring-navy/10"
        />
        <InventoryTable skus={filteredSkus} onSelect={setSelectedSKU} />
      </section>

      <aside className="rounded-2xl bg-navy p-5 text-cream">
        {selectedSKU ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-normal text-amber">Selected SKU</p>
                <h2 className="mt-1 text-2xl font-black">{selectedSKU.sku_id}</h2>
              </div>
              <StatusBadge status={selectedSKU.status} />
            </div>
            <ForecastChart data={forecastData} />
            <section className="rounded-2xl bg-cream p-5 text-navy">
              <h3 className="text-lg font-black">SHAP Driver Summary</h3>
              <p className="mt-3 text-sm font-bold text-navy/75">
                Top features: lag_7, rolling_mean_7, snap_flag
              </p>
            </section>
          </div>
        ) : (
          <div className="text-sm font-bold text-cream/75">Select a SKU to inspect its forecast.</div>
        )}
      </aside>
    </div>
  );
}
