export type StockStatus = "OK" | "AT RISK" | "STOCKOUT IMMINENT";

type StatusBadgeProps = {
  status: StockStatus;
};

const statusColors: Record<StockStatus, string> = {
  OK: "bg-sage",
  "AT RISK": "bg-lavender",
  "STOCKOUT IMMINENT": "bg-dusty-pink",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black text-white ${statusColors[status]}`}>
      {status}
    </span>
  );
}
