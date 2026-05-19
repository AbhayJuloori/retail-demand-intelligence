import InventoryTable, { type SKU } from "../components/InventoryTable";
import KPICard from "../components/KPICard";

const overviewSkus: SKU[] = [
  { sku_id: "FOODS-3-090-CA-1", status: "STOCKOUT IMMINENT", days_until_stockout: 2, recommended_order_qty: 420, trigger_date: "2026-05-21" },
  { sku_id: "HOUSE-1-224-TX-2", status: "AT RISK", days_until_stockout: 5, recommended_order_qty: 180, trigger_date: "2026-05-24" },
  { sku_id: "HOBBIES-2-048-WI-1", status: "AT RISK", days_until_stockout: 7, recommended_order_qty: 96, trigger_date: "2026-05-26" },
  { sku_id: "FOODS-2-312-CA-3", status: "AT RISK", days_until_stockout: 9, recommended_order_qty: 260, trigger_date: "2026-05-28" },
  { sku_id: "HOUSE-2-110-WI-2", status: "OK", days_until_stockout: 18, recommended_order_qty: 140, trigger_date: "2026-06-06" },
  { sku_id: "HOBBIES-1-777-TX-1", status: "OK", days_until_stockout: 21, recommended_order_qty: 80, trigger_date: "2026-06-09" },
  { sku_id: "FOODS-1-029-WI-3", status: "OK", days_until_stockout: 24, recommended_order_qty: 310, trigger_date: "2026-06-12" },
  { sku_id: "HOUSE-3-450-CA-2", status: "OK", days_until_stockout: 30, recommended_order_qty: 60, trigger_date: "2026-06-18" },
];

export default function Overview() {
  const atRiskCount = overviewSkus.filter((sku) => sku.status === "AT RISK").length;
  const stockoutCount = overviewSkus.filter((sku) => sku.status === "STOCKOUT IMMINENT").length;
  const topAtRisk = overviewSkus
    .filter((sku) => sku.status !== "OK")
    .sort((a, b) => a.days_until_stockout - b.days_until_stockout)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-black uppercase tracking-normal text-amber">Overview Dashboard</p>
        <h1 className="mt-2 text-4xl font-black lg:text-6xl">Retail Demand Intelligence</h1>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <KPICard label="Total SKUs Monitored" value={overviewSkus.length} delta="+12 vs last run" />
        <KPICard label="% At Risk" value={`${Math.round(((atRiskCount + stockoutCount) / overviewSkus.length) * 100)}%`} highlight />
        <KPICard label="Stockout Imminent" value={stockoutCount} delta="next 72 hours" />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black">Top At-Risk SKUs</h2>
          <p className="mt-1 text-sm font-bold text-navy/70">Sorted by lowest days to stockout.</p>
        </div>
        <InventoryTable skus={topAtRisk} />
      </section>
    </div>
  );
}
