"use client";

import { useEffect, useMemo, useState } from "react";
import InventoryRows from "../components/InventoryTable";
import Spinner from "../components/Spinner";
import { apiFetch } from "../lib/api";
import type { InventoryResponse, InventorySKU } from "../lib/types";

type SortKey = keyof Pick<
  InventorySKU,
  "sku_id" | "days_until_stockout" | "avg_daily_demand" | "status" | "stockout_risk_score" | "recommended_order_qty"
>;

const sortOptions: { label: string; value: SortKey }[] = [
  { label: "SKU ID", value: "sku_id" },
  { label: "Days Until Stockout", value: "days_until_stockout" },
  { label: "Avg Daily Demand", value: "avg_daily_demand" },
  { label: "Status", value: "status" },
  { label: "Risk Score", value: "stockout_risk_score" },
  { label: "Recommended Order Qty", value: "recommended_order_qty" },
];

export default function InventoryTable() {
  const [skus, setSkus] = useState<InventorySKU[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("days_until_stockout");
  const [ascending, setAscending] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<InventoryResponse>("/inventory?limit=100");
      setSkus(data.skus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visibleSkus = useMemo(() => {
    const filtered = skus.filter((sku) => {
      const matchesSearch = sku.sku_id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = status === "All" || sku.status === status;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      const result = typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue).localeCompare(String(bValue));
      return ascending ? result : -result;
    });
  }, [ascending, search, skus, sortKey, status]);

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-[1fr_220px_240px_120px] gap-3">
          <input
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
            placeholder="Search SKU ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>All</option>
            <option>OK</option>
            <option>AT RISK</option>
            <option>STOCKOUT IMMINENT</option>
          </select>
          <select
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm font-semibold text-white" onClick={() => setAscending((value) => !value)}>
            {ascending ? "Asc" : "Desc"}
          </button>
        </div>
      </section>
      <InventoryRows skus={visibleSkus} />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6">
      <h2 className="font-semibold text-[#991B1B]">Could not load inventory</h2>
      <p className="mt-2 text-sm text-[#991B1B]">{message}</p>
      <button className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
