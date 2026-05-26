"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import ForecastChart from "../components/ForecastChart";
import Spinner from "../components/Spinner";
import { apiFetch } from "../lib/api";
import { DEMO_SKUS } from "../lib/demo";
import type { ForecastResponse, InsightResponse, InventorySKU } from "../lib/types";

function statusBorder(status: string) {
  if (status === "STOCKOUT IMMINENT") return "border-l-red-500";
  if (status === "AT RISK") return "border-l-amber-400";
  return "border-l-emerald-500";
}

function statusDot(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-500";
  if (status === "AT RISK") return "bg-amber-400";
  return "bg-emerald-500";
}

function statusPill(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-50 text-red-700";
  if (status === "AT RISK") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function statusHeadline(status: string) {
  if (status === "STOCKOUT IMMINENT") return "Immediate reorder required";
  if (status === "AT RISK") return "Reorder window approaching";
  return "Inventory healthy";
}

export default function SKUExplorer() {
  const [selectedSku, setSelectedSku] = useState(DEMO_SKUS[0].sku_id);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [insight, setInsight] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("llm_api_key") || "";
    setApiKey(stored);
    setApiKeyDraft(stored);
  }, []);

  useEffect(() => {
    loadForecast(selectedSku);
  }, [selectedSku]);

  useEffect(() => {
    const sku = forecast?.inventory_state ?? DEMO_SKUS.find((s) => s.sku_id === selectedSku);
    if (sku && apiKey) loadInsight(sku, apiKey);
  }, [forecast?.sku_id, selectedSku, apiKey]);

  async function loadForecast(skuId: string) {
    setDetailLoading(true);
    setInsight("");
    try {
      const data = await apiFetch<ForecastResponse>(`/forecast/${encodeURIComponent(skuId)}?horizon=28`);
      setForecast(data);
    } catch {
      setForecast(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadInsight(sku: InventorySKU, key = apiKey) {
    setInsightLoading(true);
    try {
      const data = await apiFetch<InsightResponse>("/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(key ? { "x-llm-key": key } : {}) },
        body: JSON.stringify({
          sku_id: sku.sku_id,
          status: sku.status,
          days_until_stockout: sku.days_until_stockout,
          avg_daily_demand: sku.avg_daily_demand,
          recommended_order_qty: sku.recommended_order_qty,
          trigger_date: sku.trigger_date,
          top_shap_features: forecast?.top_3_features ?? [],
        }),
      });
      setInsight(data.insight);
    } catch (err) {
      setInsight(err instanceof Error ? err.message : "Could not generate insight");
    } finally {
      setInsightLoading(false);
    }
  }

  function submitApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = apiKeyDraft.trim();
    if (!value) return;
    setApiKey(value);
    localStorage.setItem("llm_api_key", value);
  }

  const inventoryState: InventorySKU = forecast?.inventory_state ?? DEMO_SKUS.find((s) => s.sku_id === selectedSku) ?? DEMO_SKUS[0];

  return (
    <div className="grid h-[calc(100vh-112px)] grid-cols-[260px_1fr] gap-5">
      {/* Left: SKU list */}
      <aside className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Select SKU</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {DEMO_SKUS.map((sku) => {
            const active = sku.sku_id === selectedSku;
            return (
              <button
                key={sku.sku_id}
                className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors ${
                  active ? "bg-slate-900" : "hover:bg-slate-50"
                }`}
                onClick={() => setSelectedSku(sku.sku_id)}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDot(sku.status)}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block font-mono text-xs font-medium leading-4 ${active ? "text-white" : "text-slate-700"}`}>
                    {sku.sku_id}
                  </span>
                  <span className={`mt-1 block text-xs ${active ? "text-slate-400" : "text-slate-400"}`}>
                    {sku.days_until_stockout === 999 ? "—" : `${sku.days_until_stockout}d remaining`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right: Detail panel */}
      <section className="overflow-y-auto space-y-5 pr-0.5">
        {detailLoading ? (
          <Spinner />
        ) : (
          <>
            {/* SKU header */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs text-slate-400">{inventoryState.sku_id}</p>
                <h2 className="mt-0.5 text-xl font-semibold text-slate-900">{statusHeadline(inventoryState.status)}</h2>
                <p className="mt-1 text-sm text-slate-500">28-day blended forecast · Prophet + LightGBM ensemble</p>
              </div>
              <span className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold ${statusPill(inventoryState.status)}`}>
                {inventoryState.status}
              </span>
            </div>

            {/* Inventory state tiles */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Current stock", value: inventoryState.current_stock },
                { label: "Safety stock", value: inventoryState.safety_stock },
                { label: "Reorder point", value: inventoryState.reorder_point },
                { label: "EOQ", value: inventoryState.eoq },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{Math.round(value).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* Forecast chart */}
            {forecast && <ForecastChart forecast={forecast.forecast} />}

            {/* LLM insight */}
            <div className={`border-l-[3px] ${statusBorder(inventoryState.status)} rounded-r-xl bg-white px-6 py-5 shadow-sm`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">AI Inventory Insight</h3>
                {apiKey && (
                  <button
                    className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-40"
                    disabled={insightLoading}
                    onClick={() => loadInsight(inventoryState)}
                  >
                    {insightLoading ? "Generating…" : "Refresh"}
                  </button>
                )}
              </div>

              {!apiKey && (
                <form className="mt-4" onSubmit={submitApiKey}>
                  <p className="text-xs text-slate-500">Connect an LLM API key to generate narratives for this SKU.</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                      placeholder="API key (Groq, OpenAI, Anthropic, Gemini)"
                      type="password"
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                    />
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition-colors" type="submit">
                      Connect
                    </button>
                  </div>
                  <p className="mt-3 text-xs italic leading-6 text-slate-400">
                    Example: "Stock at 38% of safety threshold. Holiday event in 9 days may spike demand 2–3×. Place order of 95 units by June 1st."
                  </p>
                </form>
              )}

              {apiKey && (
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {insightLoading ? (
                    <span className="text-slate-400">Generating insight…</span>
                  ) : insight ? (
                    insight
                  ) : (
                    <span className="text-slate-400">Insight will appear here once generated.</span>
                  )}
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
