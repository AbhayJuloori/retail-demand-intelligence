"use client";

import { useEffect, useState } from "react";
import InventoryRows from "../components/InventoryTable";
import KPICard from "../components/KPICard";
import Spinner from "../components/Spinner";
import { apiFetch } from "../lib/api";
import type { InventoryResponse, InventorySKU, MetricsResponse } from "../lib/types";

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
      setInventory(inventoryData.skus);
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

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Inventory Risk Table</h2>
          <p className="mt-1 text-sm text-[#64748B]">Top 20 SKUs by stockout risk.</p>
        </div>
        <InventoryRows skus={inventory} />
      </section>
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
