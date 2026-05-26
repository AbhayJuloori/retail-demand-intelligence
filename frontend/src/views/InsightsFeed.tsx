"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { DEMO_SKUS } from "../lib/demo";
import type { InventorySKU } from "../lib/types";

/** Call Groq directly from the browser — no backend required. */
async function callLLM(key: string, sku: InventorySKU): Promise<string> {
  const prompt = `You are a concise supply chain analyst. Write 2-3 plain-English sentences about this SKU's inventory situation and what action to take:

SKU: ${sku.sku_id}  |  Status: ${sku.status}
Days until stockout: ${sku.days_until_stockout}  |  Avg demand: ${sku.avg_daily_demand} units/day
Current stock: ${sku.current_stock}  |  Recommended order: ${sku.recommended_order_qty} units
Trigger date: ${sku.trigger_date}

Focus on the risk driver and specific timing. Be direct.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 160,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return (data.choices[0].message.content as string).trim();
}

interface InsightCardData {
  sku: InventorySKU;
  text: ReactNode;
  demo?: boolean;
}

const DEMO_CARDS: InsightCardData[] = [
  {
    sku: DEMO_SKUS.find((s) => s.sku_id === "HOUSEHOLD_1_009_TX_2")!,
    text: "Only 2 days of runway remaining — this SKU needs action today. Demand is running at 4.1 units/day with strong weekend peaks, and a price drop last week lifted volume by 18%, accelerating depletion faster than the model's baseline. Standard lead time of 7 days already exceeds the current window. An emergency order of 140 units (full EOQ) placed now is the only path to avoiding a gap on shelf.",
    demo: true,
  },
  {
    sku: DEMO_SKUS.find((s) => s.sku_id === "FOODS_3_090_CA_1")!,
    text: "Stock is sitting at 32% of safety threshold with 8 days until projected stockout. Average demand of 7.2 units/day is steady, but lag-7 and rolling_mean_28 are both trending up — a holiday event in 6 days could spike demand 2–3× above baseline. The 7-day lead time leaves virtually no margin. Placing an order of 95 units by June 1st keeps inventory above the safety line through the peak.",
    demo: true,
  },
  {
    sku: DEMO_SKUS.find((s) => s.sku_id === "HOBBIES_2_022_WI_1")!,
    text: "Inventory is healthy with 19 days of runway — above the 7-day lead time buffer but tightening. Demand is moderate at 3.7 units/day. Lag_364 data shows a +35% July uplift from the prior year for this hobbies category in Wisconsin, likely tied to the summer recreation season. Plan a pre-position of ~75 units around June 12th to stay ahead of the seasonal curve without rush ordering.",
    demo: true,
  },
];

const STATUS_STYLES = {
  "STOCKOUT IMMINENT": {
    border: "border-l-red-500",
    pill: "bg-red-50 text-red-700",
    headline: "Immediate reorder required",
  },
  "AT RISK": {
    border: "border-l-amber-400",
    pill: "bg-amber-50 text-amber-700",
    headline: "Reorder window approaching",
  },
  OK: {
    border: "border-l-emerald-500",
    pill: "bg-emerald-50 text-emerald-700",
    headline: "Inventory healthy",
  },
};

function getStyle(status: string) {
  return STATUS_STYLES[status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.OK;
}

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
      const atRisk = DEMO_SKUS.filter((s) => s.status !== "OK")
        .sort((a, b) => a.days_until_stockout - b.days_until_stockout)
        .slice(0, 10);
      const insights = await Promise.all(
        atRisk.map(async (sku) => {
          const text = await callLLM(key, sku);
          return { sku, text };
        }),
      );
      setCards(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach Groq. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  }

  function submitApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = apiKeyDraft.trim();
    if (!value) return;
    setApiKey(value);
    localStorage.setItem("llm_api_key", value);
    load(value);
  }

  if (!apiKey) {
    return (
      <div>
        <div className="mb-10 border-b border-slate-100 pb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Inventory Insight Feed</h1>
          <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">
            Connect a Groq API key to generate plain-language narratives for your highest-risk SKUs — what's
            happening, why demand is shifting, and exactly what to order and when. Calls go directly from your
            browser to Groq — no server needed.
          </p>
          <form className="mt-5 flex max-w-md gap-2" onSubmit={submitApiKey}>
            <input
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-slate-400 focus:bg-white"
              placeholder="Paste your API key to get started"
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
            />
            <button
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              type="submit"
            >
              Connect
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Groq (free · recommended)", "OpenAI", "Anthropic", "Google Gemini"].map((p) => (
              <span key={p} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
                {p}
              </span>
            ))}
          </div>
        </div>

        <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Preview — example insights</p>
        <div className="space-y-4">
          {DEMO_CARDS.map(({ sku, text, demo }) => (
            <InsightCard key={sku.sku_id} sku={sku} text={text} demo={demo} />
          ))}
        </div>
      </div>
    );
  }

  const visibleCards = cards.slice(0, visibleCount);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory Insight Feed</h1>
          <p className="mt-1 text-sm text-slate-500">LLM-generated narratives for at-risk SKUs, ranked by urgency.</p>
        </div>
        <button
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          onClick={() => load()}
        >
          Refresh
        </button>
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorState message={error} onRetry={() => load()} /> : null}
      {!loading && !error ? (
        <>
          {cards.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">No at-risk SKUs found in the current inventory snapshot.</p>
          ) : null}
          <div className="space-y-4">
            {visibleCards.map(({ sku, text, demo }) => (
              <InsightCard key={sku.sku_id} sku={sku} text={text} demo={demo} />
            ))}
          </div>
          {visibleCount < cards.length ? (
            <div className="mt-8 text-center">
              <button
                className="rounded-lg border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                onClick={() => setVisibleCount(cards.length)}
              >
                Show all {cards.length} insights
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function InsightCard({ sku, text, demo }: InsightCardData) {
  const s = getStyle(sku.status);
  return (
    <article className={`border-l-[3px] ${s.border} rounded-r-xl bg-white px-7 py-6 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide text-slate-400">{sku.sku_id}</p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-900">{s.headline}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {demo ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">demo</span> : null}
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill}`}>{sku.status}</span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-600">{typeof text === "string" ? text : <span>{text}</span>}</p>

      <div className="mt-5 flex flex-wrap gap-6 border-t border-slate-100 pt-4">
        <Stat label="Days remaining" value={sku.days_until_stockout === 999 ? "—" : `${sku.days_until_stockout}d`} />
        <Stat label="Avg demand" value={`${sku.avg_daily_demand.toFixed(1)} units/day`} />
        {sku.recommended_order_qty > 0 ? (
          <Stat label="Recommended order" value={`${Math.round(sku.recommended_order_qty).toLocaleString()} units`} />
        ) : null}
        {sku.trigger_date ? <Stat label="Trigger date" value={sku.trigger_date} /> : null}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-r-xl border-l-[3px] border-l-slate-200 bg-white" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-6">
      <h2 className="font-semibold text-red-800">Could not load insights</h2>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <button className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
