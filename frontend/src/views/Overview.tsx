"use client";

import { useMemo, useEffect, useState } from "react";
import { DEMO_SKUS } from "../lib/demo";
import { apiFetch } from "../lib/api";
import type { InventorySKU, MetricsResponse } from "../lib/types";

function rowAccent(status: string) {
  if (status === "STOCKOUT IMMINENT") return "border-l-red-500";
  if (status === "AT RISK") return "border-l-amber-400";
  return "border-l-transparent";
}

function statusPill(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-50 text-red-700";
  if (status === "AT RISK") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function statusDot(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-500";
  if (status === "AT RISK") return "bg-amber-400";
  return "bg-emerald-500";
}

export default function Overview() {
  const [wrmsse, setWrmsse] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    apiFetch<MetricsResponse>("/metrics")
      .then((m) => setWrmsse(m.val_wrmsse))
      .catch(() => null);
  }, []);

  const stockout = useMemo(() => DEMO_SKUS.filter((s) => s.status === "STOCKOUT IMMINENT").length, []);
  const atRisk = useMemo(() => DEMO_SKUS.filter((s) => s.status === "AT RISK").length, []);
  const ok = useMemo(() => DEMO_SKUS.filter((s) => s.status === "OK").length, []);

  const filtered = useMemo(() => {
    return DEMO_SKUS.filter((sku) => {
      const matchSearch = sku.sku_id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || sku.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  return (
    <div className="space-y-8">
      {/* Critical alert strip */}
      {stockout > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-3.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <p className="text-sm font-medium text-red-800">
            <strong>{stockout} SKU{stockout > 1 ? "s" : ""} require immediate action</strong> — stockout within 5 days.
            Check the table below and place emergency orders.
          </p>
        </div>
      )}

      {/* KPI row */}
      <section className="grid grid-cols-4 gap-4">
        <KPICard
          label="Stockout Imminent"
          value={stockout}
          sub="Requires immediate order"
          color="red"
        />
        <KPICard
          label="At Risk"
          value={atRisk}
          sub="Order within lead time"
          color="amber"
        />
        <KPICard
          label="Healthy"
          value={ok}
          sub="No action required"
          color="green"
        />
        <KPICard
          label="WRMSSE"
          value={wrmsse !== null ? wrmsse.toFixed(3) : "—"}
          sub="Forecast accuracy score"
          color="blue"
        />
      </section>

      {/* Risk distribution bar */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Risk distribution across {DEMO_SKUS.length} SKUs</h2>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
          <div className="bg-red-500 transition-all" style={{ width: `${(stockout / DEMO_SKUS.length) * 100}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${(atRisk / DEMO_SKUS.length) * 100}%` }} />
          <div className="bg-emerald-500 transition-all" style={{ width: `${(ok / DEMO_SKUS.length) * 100}%` }} />
        </div>
        <div className="mt-3 flex gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Stockout Imminent ({Math.round((stockout / DEMO_SKUS.length) * 100)}%)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />At Risk ({Math.round((atRisk / DEMO_SKUS.length) * 100)}%)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Healthy ({Math.round((ok / DEMO_SKUS.length) * 100)}%)</span>
        </div>
      </section>

      {/* Table section */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Inventory risk table</h2>
            <p className="mt-0.5 text-xs text-slate-400">Simulated scenarios from M5 Walmart dataset — sorted by urgency</p>
          </div>
          <div className="flex gap-2">
            <input
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:bg-white"
              placeholder="Search SKU ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 focus:bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All statuses</option>
              <option value="STOCKOUT IMMINENT">Stockout Imminent</option>
              <option value="AT RISK">At Risk</option>
              <option value="OK">Healthy</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">SKU ID</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Days Left</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Demand</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Risk</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Rec. Order</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Trigger Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((sku) => (
                <tr key={sku.sku_id} className={`border-l-[3px] ${rowAccent(sku.status)} transition-colors hover:bg-slate-50`}>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-medium text-slate-700">{sku.sku_id}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(sku.status)}`} />
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill(sku.status)}`}>{sku.status}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-700">
                    {sku.days_until_stockout === 999 ? "—" : `${sku.days_until_stockout}d`}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-700">{sku.avg_daily_demand.toFixed(1)}/day</td>
                  <td className="min-w-[140px] px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${sku.stockout_risk_score >= 80 ? "bg-red-500" : sku.stockout_risk_score >= 40 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${sku.stockout_risk_score}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs tabular-nums text-slate-400">{sku.stockout_risk_score}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-slate-700">
                    {sku.recommended_order_qty > 0 ? `${sku.recommended_order_qty.toLocaleString()} units` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{sku.trigger_date || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-slate-400" colSpan={7}>
                    No SKUs match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: "red" | "amber" | "green" | "blue" }) {
  const valueColor = {
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-emerald-600",
    blue: "text-blue-600",
  }[color];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
