"use client";

import { useMemo, useState } from "react";
import StatusBadge, { type StockStatus } from "./StatusBadge";

export type SKU = {
  sku_id: string;
  status: StockStatus;
  days_until_stockout: number;
  recommended_order_qty: number;
  trigger_date: string;
};

type InventoryTableProps = {
  skus: SKU[];
  onSelect?: (sku: SKU) => void;
};

export default function InventoryTable({ skus, onSelect }: InventoryTableProps) {
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);

  const sortedSkus = useMemo(() => {
    return [...skus].sort((a, b) => {
      const diff = a.days_until_stockout - b.days_until_stockout;
      return sortDirection === "asc" ? diff : -diff;
    });
  }, [skus, sortDirection]);

  function handleSelect(sku: SKU) {
    setSelectedSkuId(sku.sku_id);
    onSelect?.(sku);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-navy/10 bg-cream">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="bg-navy text-cream">
            <tr>
              <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">SKU ID</th>
              <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">Status</th>
              <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">
                <button
                  className="font-black uppercase"
                  onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
                >
                  Days to Stockout {sortDirection === "asc" ? "ASC" : "DESC"}
                </button>
              </th>
              <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">Reorder Qty</th>
              <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">Trigger Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedSkus.map((sku) => {
              const isSelected = selectedSkuId === sku.sku_id;

              return (
                <tr
                  key={sku.sku_id}
                  onClick={() => handleSelect(sku)}
                  className={`cursor-pointer border-b border-navy/10 transition last:border-b-0 ${
                    isSelected ? "bg-navy text-cream" : "hover:bg-navy/5"
                  }`}
                >
                  <td className="px-5 py-4 font-black">{sku.sku_id}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={sku.status} />
                  </td>
                  <td className="px-5 py-4 font-bold">{sku.days_until_stockout}</td>
                  <td className="px-5 py-4">{sku.recommended_order_qty.toLocaleString()}</td>
                  <td className="px-5 py-4">{sku.trigger_date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
