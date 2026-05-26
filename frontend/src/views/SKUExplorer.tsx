"use client";

import { useEffect, useMemo, useState } from "react";
import ForecastChart from "../components/ForecastChart";
import Spinner from "../components/Spinner";
import { apiFetch } from "../lib/api";
import { DEMO_SKUS } from "../lib/demo";
import type { ForecastResponse, ForecastRow, InventorySKU } from "../lib/types";

function statusDot(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-500";
  if (status === "AT RISK") return "bg-amber-400";
  return "bg-emerald-500";
}

function statusPill(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "AT RISK") return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200";
}

function statusBorder(status: string) {
  if (status === "STOCKOUT IMMINENT") return "border-l-red-500";
  if (status === "AT RISK") return "border-l-amber-400";
  return "border-l-emerald-400";
}

function statusHeadline(status: string, days: number) {
  if (status === "STOCKOUT IMMINENT") return `${days} days until stockout — act now`;
  if (status === "AT RISK") return `${days} days remaining — reorder window open`;
  return `${days === 999 ? "—" : days} days of runway — no action needed`;
}

/** Generate a plausible 28-day forecast from inventory state when the API has no data for this SKU */
function syntheticForecast(sku: InventorySKU): ForecastRow[] {
  const origin = new Date(2026, 4, 25);
  return Array.from({ length: 28 }, (_, i) => {
    const date = new Date(origin);
    date.setDate(origin.getDate() + i);
    const trend = sku.avg_daily_demand;
    const wave = Math.sin(i * 0.9) * trend * 0.18 + Math.sin(i * 0.3) * trend * 0.1;
    const yhat = Math.max(0, trend + wave);
    const band = trend * 0.22;
    return {
      date: date.toISOString().split("T")[0],
      yhat,
      yhat_lower: Math.max(0, yhat - band),
      yhat_upper: yhat + band,
      blended: yhat,
    };
  });
}

export default function SKUExplorer() {
  const [skus, setSkus] = useState<InventorySKU[]>(DEMO_SKUS);
  const [selectedId, setSelectedId] = useState(DEMO_SKUS[0].sku_id);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [forecastMeta, setForecastMeta] = useState<{ w_prophet: number; w_lgbm: number; features: string[] } | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  /* Left panel always shows the curated DEMO_SKUS — real API is called per-SKU for forecast only */

  /* Load forecast whenever selected SKU changes */
  useEffect(() => {
    if (!selectedId) return;
    const sku = skus.find((s) => s.sku_id === selectedId);
    if (!sku) return;
    loadForecast(sku);
  }, [selectedId, skus]);

  async function loadForecast(sku: InventorySKU) {
    setLoading(true);
    try {
      const data = await apiFetch<ForecastResponse>(`/forecast/${encodeURIComponent(sku.sku_id)}?horizon=28`);
      setForecast(data.forecast);
      setForecastMeta({ w_prophet: data.w_prophet, w_lgbm: data.w_lightgbm, features: data.top_3_features });
      setIsDemo(false);
    } catch {
      /* API doesn't have this SKU — show a synthetic forecast so the chart is never empty */
      setForecast(syntheticForecast(sku));
      setForecastMeta(null);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }

  const selected = useMemo(() => skus.find((s) => s.sku_id === selectedId) ?? skus[0], [selectedId, skus]);

  const visible = useMemo(
    () => skus.filter((s) => s.sku_id.toLowerCase().includes(search.toLowerCase())),
    [skus, search],
  );

  return (
    <div className="flex h-[calc(100vh-112px)] gap-5">
      {/* ── Left panel: SKU list ── */}
      <aside className="flex w-[240px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <input
            aria-label="Search SKUs"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
            placeholder="Search SKU ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-slate-50" role="listbox" aria-label="SKU list">
          {visible.map((sku) => {
            const active = sku.sku_id === selectedId;
            return (
              <li key={sku.sku_id} role="option" aria-selected={active}>
                <button
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                    active ? "bg-slate-900" : "hover:bg-slate-50"
                  }`}
                  onClick={() => setSelectedId(sku.sku_id)}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(sku.status)}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-mono text-[11px] font-medium leading-4 ${active ? "text-white" : "text-slate-700"}`}>
                      {sku.sku_id}
                    </span>
                    <span className={`mt-0.5 block text-[11px] ${active ? "text-slate-400" : "text-slate-400"}`}>
                      {sku.days_until_stockout === 999 ? "No data" : `${sku.days_until_stockout}d · ${sku.avg_daily_demand.toFixed(1)}/day`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-4 py-8 text-center text-xs text-slate-400">No SKUs match "{search}"</li>
          )}
        </ul>

        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] text-slate-400">{skus.length} SKUs loaded</p>
        </div>
      </aside>

      {/* ── Right panel: Detail ── */}
      <section className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto">
        {/* Header */}
        <div className={`rounded-r-xl border-l-[3px] ${statusBorder(selected.status)} rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-wide text-slate-400">{selected.sku_id}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {statusHeadline(selected.status, selected.days_until_stockout)}
              </h2>
            </div>
            <span className={`mt-0.5 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusPill(selected.status)}`}>
              {selected.status}
            </span>
          </div>

          {/* Metric strip */}
          <div className="mt-5 grid grid-cols-4 gap-3">
            {[
              { label: "Current stock", value: `${Math.round(selected.current_stock)} units` },
              { label: "Safety stock", value: `${Math.round(selected.safety_stock)} units` },
              { label: "Reorder point", value: `${Math.round(selected.reorder_point)} units` },
              { label: "EOQ", value: `${Math.round(selected.eoq)} units` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-1 text-base font-bold tabular-nums text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          {selected.recommended_order_qty > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <strong>Recommended order:</strong> {Math.round(selected.recommended_order_qty).toLocaleString()} units
              {selected.trigger_date ? ` — trigger by ${selected.trigger_date}` : ""}
            </div>
          )}
        </div>

        {/* Forecast chart */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">28-Day Demand Forecast</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {isDemo
                    ? "Synthetic forecast — model not trained on this SKU"
                    : forecastMeta
                      ? `Prophet ${Math.round(forecastMeta.w_prophet * 100)}% · LightGBM ${Math.round(forecastMeta.w_lgbm * 100)}% blend`
                      : "Blended forecast"}
                </p>
              </div>
              {isDemo && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                  Illustrative
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <ForecastChart forecast={forecast} />
            )}
          </div>
        </div>

        {/* Top features — only when real model data available */}
        {forecastMeta && forecastMeta.features.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Top demand drivers</h3>
            <p className="mt-0.5 text-xs text-slate-400">SHAP features with highest influence on this SKU's forecast</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {forecastMeta.features.map((f, i) => (
                <span
                  key={f}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    i === 0
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
