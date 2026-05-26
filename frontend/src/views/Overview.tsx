"use client";

import { useEffect, useState } from "react";
import InventoryRows from "../components/InventoryTable";
import KPICard from "../components/KPICard";
import Spinner from "../components/Spinner";
import { apiFetch } from "../lib/api";
import type { InventoryResponse, InventorySKU, MetricsResponse } from "../lib/types";

const PINNED_SKUS: InventorySKU[] = [
  {
    sku_id: "HOUSEHOLD_1_009_TX_2",
    status: "STOCKOUT IMMINENT",
    days_until_stockout: 3,
    avg_daily_demand: 4.1,
    current_stock: 12,
    safety_stock: 80,
    reorder_point: 58,
    eoq: 140,
    stockout_risk_score: 95,
    recommended_order_qty: 140,
    trigger_date: "2026-05-28",
  },
  {
    sku_id: "FOODS_3_090_CA_1",
    status: "AT RISK",
    days_until_stockout: 11,
    avg_daily_demand: 7.2,
    current_stock: 38,
    safety_stock: 100,
    reorder_point: 75,
    eoq: 120,
    stockout_risk_score: 72,
    recommended_order_qty: 95,
    trigger_date: "2026-06-01",
  },
];

export default function Overview() {
  const [inventory, setInventory] = useState<InventorySKU[]>([]);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [inventoryData, metricsData] = await Promise.all([
        apiFetch<InventoryResponse>("/inventory?limit=20"),
        apiFetch<MetricsResponse>("/metrics"),
      ]);
      const pinnedIds = new Set(PINNED_SKUS.map((s) => s.sku_id));
      const merged = [...PINNED_SKUS, ...inventoryData.skus.filter((s) => !pinnedIds.has(s.sku_id))];
      setInventory(merged);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load overview data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const atRisk = inventory.filter((sku) => sku.status === "AT RISK").length;
  const stockout = inventory.filter((sku) => sku.status === "STOCKOUT IMMINENT").length;

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-4 gap-4">
        <KPICard title="WRMSSE Score" value={metrics?.val_wrmsse?.toFixed(3) ?? "N/A"} note="Model Accuracy, lower is better" tone="blue" />
        <KPICard title="SKUs Tracked" value={inventory.length.toLocaleString()} note="Inventory response count" />
        <KPICard title="At Risk" value={atRisk.toLocaleString()} note="Needs ordering attention" tone="amber" />
        <KPICard title="Stockout Imminent" value={stockout.toLocaleString()} note="Critical reorder window" tone="red" />
      </section>

      <section className="grid grid-cols-3 gap-4">
        <RiskBand label="Stockout Imminent" count={stockout} total={inventory.length} color="red" />
        <RiskBand label="At Risk" count={atRisk} total={inventory.length} color="amber" />
        <RiskBand label="OK" count={inventory.length - atRisk - stockout} total={inventory.length} color="green" />
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Inventory Risk Table</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Top {Math.min(inventory.length, 20)} SKUs — {stockout} critical, {atRisk} at risk
          </p>
        </div>
        <InventoryRows skus={inventory} />
      </section>
    </div>
  );
}

function RiskBand({ label, count, total, color }: { label: string; count: number; total: number; color: "red" | "amber" | "green" }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const barColor = color === "red" ? "bg-red-500" : color === "amber" ? "bg-amber-400" : "bg-green-500";
  const bgColor = color === "red" ? "bg-red-50 border-red-200" : color === "amber" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200";
  const textColor = color === "red" ? "text-red-700" : color === "amber" ? "text-amber-700" : "text-green-700";

  return (
    <div className={"rounded-xl border p-4 " + bgColor}>
      <p className={"text-xs font-semibold uppercase tracking-wider " + textColor}>{label}</p>
      <p className={"mt-1 text-3xl font-bold " + textColor}>{count}</p>
      <div className="mt-3 h-2 w-full rounded-full bg-white/60">
        <div className={"h-2 rounded-full transition-all " + barColor} style={{ width: pct + "%" }} />
      </div>
      <p className={"mt-1 text-xs font-medium " + textColor}>
        {pct}% of {total} SKUs loaded
      </p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
      <h2 className="font-semibold text-[#991B1B]">Could not load overview</h2>
      <p className="mt-2 text-sm text-[#991B1B]">{message}</p>
      <button className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
