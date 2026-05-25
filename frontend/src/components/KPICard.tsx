interface KPICardProps {
  title: string;
  value: string | number;
  note?: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}

const toneClasses = {
  blue: "text-[#2563EB]",
  green: "text-[#16A34A]",
  amber: "text-[#D97706]",
  red: "text-[#DC2626]",
  slate: "text-[#0F172A]",
};

export default function KPICard({ title, value, note, tone = "slate" }: KPICardProps) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#64748B]">{title}</p>
      <p className={`mt-3 text-3xl font-bold ${toneClasses[tone]}`}>{value}</p>
      {note ? <p className="mt-2 text-sm text-[#64748B]">{note}</p> : null}
    </section>
  );
}
