"use client";

import { useEffect, useMemo, useState } from "react";
import KPICard from "../components/KPICard";
import SHAPChart from "../components/SHAPChart";
import Spinner from "../components/Spinner";
import { apiFetch } from "../lib/api";
import type { MetricsResponse } from "../lib/types";

export default function ModelMetrics() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await apiFetch<MetricsResponse>("/metrics"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const backtestRows = useMemo(() => {
    if (!metrics?.backtest) return [];
    return Object.entries(metrics.backtest).map(([skuId, value]) => ({
      skuId,
      value: typeof value === "object" && value !== null ? JSON.stringify(value) : String(value),
    }));
  }, [metrics]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!metrics) return null;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-4 gap-4">
        <KPICard title="WRMSSE" value={metrics.val_wrmsse?.toFixed(3) ?? "N/A"} note="Validation weighted RMSSE" tone="blue" />
        <KPICard title="RMSE" value={metrics.val_rmse?.toFixed(2) ?? "N/A"} note="Validation root mean squared error" />
        <KPICard title="Run Date" value={metrics.run_date ? new Date(metrics.run_date).toLocaleDateString() : "N/A"} note={metrics.run_id.slice(0, 10)} />
        <KPICard title="SKUs" value={metrics.n_skus.toLocaleString()} note="Models tracked" tone="green" />
      </section>

      <SHAPChart importance={metrics.shap_importance || {}} />

      <section className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Backtest Results</h2>
        </div>
        {backtestRows.length > 0 ? (
          <table className="min-w-full divide-y divide-[#E2E8F0] text-left text-sm">
            <thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-semibold">SKU ID</th>
                <th className="px-4 py-3 font-semibold">Backtest Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {backtestRows.map((row) => (
                <tr key={row.skuId}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0F172A]">{row.skuId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748B]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-6 text-sm text-[#64748B]">No backtest data</p>
        )}
      </section>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
      <h2 className="font-semibold text-[#991B1B]">Could not load model metrics</h2>
      <p className="mt-2 text-sm text-[#991B1B]">{message}</p>
      <button className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
