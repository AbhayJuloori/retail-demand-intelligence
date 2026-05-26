"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { apiFetch } from "../lib/api";
import type { InsightResponse, InventoryResponse, InventorySKU } from "../lib/types";

interface InsightCardData {
  sku: InventorySKU;
  text: ReactNode;
  demo?: boolean;
}

const demoSku: InventorySKU = {
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
};

export default function InsightsFeed() {
  const [apiKey, setApiKey] = useState("");
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [cards, setCards] = useState<InsightCardData[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem("llm_api_key") || "";
    setApiKey(storedKey);
    setApiKeyDraft(storedKey);
    if (storedKey) {
      load(storedKey);
    } else {
      setLoading(false);
    }
  }, []);

  async function load(key = apiKey) {
    setLoading(true);
    setError(null);
    setVisibleCount(3);
    try {
      const inventory = await apiFetch<InventoryResponse>("/inventory?limit=50");
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

  function submitApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = apiKeyDraft.trim();
    if (!value) return;
    saveApiKey(value);
    load(value);
  }

  if (!apiKey) {
    return (
      <div className="max-w-3xl rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#0F172A]">🔑 LLM Insight Feed</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">
          Enter an API key to generate AI-powered supply chain narratives for your at-risk SKUs.
        </p>
        <p className="mt-4 text-sm font-semibold text-[#334155]">Supported: Groq (free), OpenAI, Anthropic, Gemini</p>
        <form className="mt-3 flex gap-3" onSubmit={submitApiKey}>
          <input
            className="min-w-0 flex-1 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
            placeholder="API key"
            type="password"
            value={apiKeyDraft}
            onChange={(event) => setApiKeyDraft(event.target.value)}
          />
          <button className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" type="submit">
            Save Key →
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E2E8F0]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Example insight (demo)</span>
          <div className="h-px flex-1 bg-[#E2E8F0]" />
        </div>

        <InsightArticle demo sku={demoSku} text={<DemoInsightText />} />
        <p className="mt-3 text-sm text-[#64748B]">↑ This is what your insights will look like</p>
      </div>
    );
  }

  const visibleCards = cards.slice(0, visibleCount);

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
        <>
          <div className="grid grid-cols-2 gap-4">
            {visibleCards.map(({ sku, text, demo }) => (
              <InsightArticle key={sku.sku_id} demo={demo} sku={sku} text={text} />
            ))}
          </div>
          {visibleCount < cards.length ? (
            <div className="flex justify-center">
              <button className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white" onClick={() => setVisibleCount(cards.length)}>
                Show More
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function InsightArticle({ sku, text, demo }: InsightCardData) {
  return (
    <article className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[#0F172A]">{sku.sku_id}</h3>
          {demo ? <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-semibold text-[#64748B]">Demo</span> : null}
        </div>
        <StatusBadge status={sku.status} />
      </div>
      {typeof text === "string" ? <p className="mt-4 text-sm leading-6 text-[#334155]">{text}</p> : <div className="mt-4 text-sm leading-6 text-[#334155]">{text}</div>}
      <div className="mt-5 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-xs font-semibold text-[#64748B]">
        <span>Trigger: {sku.trigger_date || "N/A"}</span>
        <span>Order Qty: {Math.round(sku.recommended_order_qty).toLocaleString()}</span>
      </div>
    </article>
  );
}

function DemoInsightText() {
  return (
    <div className="space-y-3">
      <p>
        <span className="font-semibold text-[#0F172A]">Status:</span> Stock at 38% of safety threshold with 11 days until projected stockout.
      </p>
      <p>
        <span className="font-semibold text-[#0F172A]">Trend:</span> Avg demand of 7.2 units/day; lag-7 and rolling_mean_28 are top demand drivers. Holiday
        event in 9 days may spike demand 2–3×.
      </p>
      <p>
        <span className="font-semibold text-[#0F172A]">Recommendation:</span> Place order of 95 units by 2026-06-01 to avoid stockout before next delivery.
      </p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
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
