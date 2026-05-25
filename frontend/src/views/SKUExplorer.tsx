"use client";

import { useEffect, useMemo, useState } from "react";
import ForecastChart from "../components/ForecastChart";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { apiFetch } from "../lib/api";
import type { ForecastResponse, InsightResponse, InventoryResponse, InventorySKU } from "../lib/types";

export default function SKUExplorer() {
  const [skus, setSkus] = useState<InventorySKU[]>([]);
  const [selectedSku, setSelectedSku] = useState("");
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [insight, setInsight] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("llm_api_key") || "");
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<InventoryResponse>("/inventory?limit=100");
      setSkus(data.skus);
      setSelectedSku(data.skus[0]?.sku_id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load SKUs");
    } finally {
      setLoading(false);
    }
  }

  const selectedInventory = useMemo(() => skus.find((sku) => sku.sku_id === selectedSku), [selectedSku, skus]);

  useEffect(() => {
    if (!selectedSku) return;
    loadForecast(selectedSku);
  }, [selectedSku]);

  useEffect(() => {
    if (!forecast?.inventory_state || !apiKey) return;
    loadInsight(forecast.inventory_state, apiKey);
  }, [forecast?.sku_id, apiKey]);

  async function loadForecast(skuId: string) {
    setDetailLoading(true);
    setInsight("");
    try {
      const data = await apiFetch<ForecastResponse>(`/forecast/${encodeURIComponent(skuId)}?horizon=28`);
      setForecast(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load forecast");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadInsight(sku: InventorySKU, key = apiKey) {
    setInsightLoading(true);
    try {
      const data = await apiFetch<InsightResponse>("/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { "x-llm-key": key } : {}),
        },
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

  function saveApiKey(value: string) {
    setApiKey(value);
    localStorage.setItem("llm_api_key", value);
  }

  if (loading) return <Spinner />;
  if (error && skus.length === 0) return <ErrorState message={error} onRetry={loadInventory} />;

  const inventoryState = forecast?.inventory_state || selectedInventory;

  return (
    <div className="grid h-[calc(100vh-112px)] grid-cols-[1fr_2fr] gap-5">
      <aside className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <h2 className="font-semibold text-[#0F172A]">SKU IDs</h2>
        </div>
        <div className="max-h-full overflow-y-auto p-2">
          {skus.map((sku) => (
            <button
              key={sku.sku_id}
              className={`mb-2 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left ${
                selectedSku === sku.sku_id ? "bg-[#EFF6FF] ring-1 ring-[#2563EB]" : "hover:bg-[#F8FAFC]"
              }`}
              onClick={() => setSelectedSku(sku.sku_id)}
            >
              <span>
                <span className="block text-sm font-semibold text-[#0F172A]">{sku.sku_id}</span>
                <span className="mt-1 block text-xs text-[#64748B]">{sku.days_until_stockout} days</span>
              </span>
              <StatusBadge status={sku.status} />
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-5 overflow-y-auto pr-1">
        {detailLoading || !inventoryState ? (
          <Spinner />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A]">{inventoryState.sku_id}</h2>
                <p className="mt-1 text-sm text-[#64748B]">28-day blended forecast and inventory state.</p>
              </div>
              <StatusBadge status={inventoryState.status} />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <StateCard label="Current Stock" value={inventoryState.current_stock} />
              <StateCard label="Safety Stock" value={inventoryState.safety_stock} />
              <StateCard label="Reorder Point" value={inventoryState.reorder_point} />
              <StateCard label="EOQ" value={inventoryState.eoq} />
            </div>

            {forecast ? <ForecastChart forecast={forecast.forecast} /> : null}

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-[#0F172A]">LLM Insight</h3>
                <button
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={!apiKey || insightLoading}
                  onClick={() => inventoryState && loadInsight(inventoryState)}
                >
                  Refresh Insight
                </button>
              </div>
              {!apiKey ? (
                <input
                  className="mb-4 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                  placeholder="Enter API key for LLM insights"
                  type="password"
                  onBlur={(event) => saveApiKey(event.target.value)}
                />
              ) : null}
              <p className="min-h-[80px] text-sm leading-6 text-[#334155]">
                {insightLoading ? "Generating insight..." : insight || "No insight generated yet."}
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function StateCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0F172A]">{Math.round(value).toLocaleString()}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
      <h2 className="font-semibold text-[#991B1B]">Could not load SKU explorer</h2>
      <p className="mt-2 text-sm text-[#991B1B]">{message}</p>
      <button className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
