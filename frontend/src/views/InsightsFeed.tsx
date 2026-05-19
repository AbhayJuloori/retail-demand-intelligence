"use client";

import { useState } from "react";
import StatusBadge, { type StockStatus } from "../components/StatusBadge";

type Insight = {
  id: string;
  status: StockStatus;
  narrative: string;
};

const insights: Insight[] = [
  {
    id: "FOODS-3-090-CA-1",
    status: "STOCKOUT IMMINENT",
    narrative:
      "Demand is running 28% above the seven-day baseline. Current inventory will cover two days unless the replenishment order is advanced.",
  },
  {
    id: "HOUSE-1-224-TX-2",
    status: "AT RISK",
    narrative:
      "Weekly seasonality is lifting forecast volume into the weekend. Reorder 180 units by May 24 to keep service level above target.",
  },
  {
    id: "HOBBIES-2-048-WI-1",
    status: "AT RISK",
    narrative:
      "The rolling mean has climbed for three consecutive runs. Safety stock is narrowing, with seven days remaining at expected demand.",
  },
  {
    id: "FOODS-2-312-CA-3",
    status: "AT RISK",
    narrative:
      "SNAP-week demand is projected to exceed the baseline curve. The recommended order covers the forecast band midpoint plus buffer.",
  },
  {
    id: "HOUSE-2-110-WI-2",
    status: "OK",
    narrative:
      "Inventory coverage remains healthy against the upper forecast interval. No urgent reorder is needed in this planning window.",
  },
];

export default function InsightsFeed() {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [showByok, setShowByok] = useState(false);

  function regenerate(id: string) {
    setRegeneratingId(id);
    window.setTimeout(() => setRegeneratingId(null), 1500);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-amber">Insights Feed</p>
          <h1 className="mt-2 text-4xl font-black lg:text-6xl">Generated Inventory Narratives</h1>
        </div>
        <button
          onClick={() => setShowByok(true)}
          className="rounded-full bg-amber px-5 py-3 text-sm font-black text-navy shadow-sm"
        >
          BYOK Modal
        </button>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight) => (
          <article key={insight.id} className="flex min-h-[260px] flex-col rounded-2xl bg-navy p-6 text-cream">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black">{insight.id}</h2>
              <StatusBadge status={insight.status} />
            </div>
            <p className="mt-5 line-clamp-3 text-base font-bold leading-7 text-cream/80">{insight.narrative}</p>
            <button
              onClick={() => regenerate(insight.id)}
              className="mt-auto rounded-full bg-amber px-5 py-3 text-sm font-black text-navy transition hover:brightness-95"
            >
              {regeneratingId === insight.id ? "Regenerating..." : "Regenerate"}
            </button>
          </article>
        ))}
      </section>

      {showByok ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-navy/40 p-6">
          <section className="w-full max-w-md rounded-2xl bg-cream p-6 text-navy shadow-xl">
            <h2 className="text-2xl font-black">Bring Your Own Key</h2>
            <p className="mt-3 text-sm font-bold text-navy/70">
              Add a Groq API key to regenerate insights with your own quota.
            </p>
            <button
              onClick={() => setShowByok(false)}
              className="mt-6 rounded-full bg-navy px-5 py-3 text-sm font-black text-cream"
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
