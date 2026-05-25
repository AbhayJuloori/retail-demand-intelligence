"use client";

import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { apiFetch } from "../lib/api";
import type { InsightResponse, InventoryResponse, InventorySKU } from "../lib/types";

interface InsightCard {
  sku: InventorySKU;
  text: string;
}

export default function InsightsFeed() {
  const [apiKey, setApiKey] = useState("");
  const [cards, setCards] = useState<InsightCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem("llm_api_key") || "";
    setApiKey(storedKey);
    if (storedKey) {
      load(storedKey);
    } else {
      setLoading(false);
    }
  }, []);

  async function load(key = apiKey) {
    setLoading(true);
    setError(null);
    try {
      const inventory = await apiFetch<InventoryResponse>("/inventory?limit=100");
      const topSkus = inventory.skus
        .filter((sku) => sku.status !== "OK")
        .sort((a, b) => a.days_until_stockout - b.days_until_stockout)
        .slice(0, 10);
      const insights = await Promise.all(
        topSkus.map(async (sku) => {
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
              top_shap_features: [],
            }),
          });
          return { sku, text: data.insight };
        }),
      );
      setCards(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load insights");
    } finally {
      setLoading(false);
    }
  }

  function saveApiKey(value: string) {
    setApiKey(value);
    localStorage.setItem("llm_api_key", value);
  }

  if (!apiKey) {
    return (
      <div className="max-w-xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0F172A]">LLM API Key Required</h2>
        <p className="mt-2 text-sm text-[#64748B]">Enter a key to generate the insight feed for at-risk SKUs.</p>
        <input
          className="mt-4 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
          placeholder="API key"
          type="password"
          onBlur={(event) => {
            saveApiKey(event.target.value);
            if (event.target.value) load(event.target.value);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">At-Risk Insight Feed</h2>
          <p className="mt-1 text-sm text-[#64748B]">Generated narratives for the top 10 risk-ranked SKUs.</p>
        </div>
        <button className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" onClick={() => load()}>
          Refresh All
        </button>
      </div>

      {loading ? <Skeleton /> : null}
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}
      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-4">
          {cards.map(({ sku, text }) => (
            <article key={sku.sku_id} className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-[#0F172A]">{sku.sku_id}</h3>
                <StatusBadge status={sku.status} />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#334155]">{text}</p>
              <div className="mt-5 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-xs font-semibold text-[#64748B]">
                <span>Trigger: {sku.trigger_date || "N/A"}</span>
                <span>Order Qty: {Math.round(sku.recommended_order_qty).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
      <h2 className="font-semibold text-[#991B1B]">Could not load insights</h2>
      <p className="mt-2 text-sm text-[#991B1B]">{message}</p>
      <button className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
