interface StatusBadgeProps {
  status: string;
}

function badgeClasses(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "OK") return "bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]";
  if (normalized === "AT RISK") return "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]";
  if (normalized === "STOCKOUT IMMINENT") return "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]";
  return "bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]";
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClasses(status)}`}>
      {status}
    </span>
  );
}
