import type { InventorySKU } from "../lib/types";
import StatusBadge from "./StatusBadge";

interface InventoryTableProps {
  skus: InventorySKU[];
}

export default function InventoryTable({ skus }: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
      <table className="min-w-full divide-y divide-[#E2E8F0] text-left text-sm">
        <thead className="bg-[#F8FAFC] text-xs uppercase tracking-wide text-[#64748B]">
          <tr>
            <th className="px-4 py-3 font-semibold">SKU ID</th>
            <th className="px-4 py-3 font-semibold">Days Until Stockout</th>
            <th className="px-4 py-3 font-semibold">Avg Daily Demand</th>
            <th className="px-4 py-3 font-semibold">Status Badge</th>
            <th className="px-4 py-3 font-semibold">Risk Score</th>
            <th className="px-4 py-3 font-semibold">Recommended Order Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] text-[#0F172A]">
          {skus.map((sku) => (
            <tr key={sku.sku_id} className="hover:bg-[#F8FAFC]">
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{sku.sku_id}</td>
              <td className="px-4 py-3">{sku.days_until_stockout}</td>
              <td className="px-4 py-3">{sku.avg_daily_demand.toFixed(1)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={sku.status} />
              </td>
              <td className="min-w-[180px] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]">
                    <div
                      className="h-full rounded-full bg-[#2563EB]"
                      style={{ width: `${Math.min(100, Math.max(0, sku.stockout_risk_score))}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-[#64748B]">{Math.round(sku.stockout_risk_score)}%</span>
                </div>
              </td>
              <td className="px-4 py-3">{Math.round(sku.recommended_order_qty).toLocaleString()}</td>
            </tr>
          ))}
          {skus.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-[#64748B]" colSpan={6}>
                No SKUs match the current filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
