import type { InventorySKU } from "../lib/types";

interface InventoryTableProps {
  skus: InventorySKU[];
}

function rowAccent(status: string) {
  if (status === "STOCKOUT IMMINENT") return "border-l-red-500";
  if (status === "AT RISK") return "border-l-amber-400";
  return "border-l-transparent";
}

function statusPill(status: string) {
  if (status === "STOCKOUT IMMINENT") return "bg-red-50 text-red-700";
  if (status === "AT RISK") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export default function InventoryTable({ skus }: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">SKU ID</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Days Left</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Demand</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Risk Score</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Rec. Order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {skus.map((sku) => (
            <tr key={sku.sku_id} className={`border-l-[3px] ${rowAccent(sku.status)} transition-colors hover:bg-slate-50`}>
              <td className="px-5 py-3.5 font-mono text-xs font-medium text-slate-700">{sku.sku_id}</td>
              <td className="px-5 py-3.5">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(sku.status)}`}>{sku.status}</span>
              </td>
              <td className="px-5 py-3.5 text-slate-700">{sku.days_until_stockout === 999 ? "—" : sku.days_until_stockout}</td>
              <td className="px-5 py-3.5 text-slate-700">{sku.avg_daily_demand.toFixed(1)}/day</td>
              <td className="min-w-[160px] px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${sku.stockout_risk_score >= 80 ? "bg-red-500" : sku.stockout_risk_score >= 50 ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, sku.stockout_risk_score))}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-slate-400">{Math.round(sku.stockout_risk_score)}%</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-700">{Math.round(sku.recommended_order_qty).toLocaleString()}</td>
            </tr>
          ))}
          {skus.length === 0 ? (
            <tr>
              <td className="px-5 py-10 text-center text-slate-400" colSpan={6}>
                No SKUs to display.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
