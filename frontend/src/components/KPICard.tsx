interface KPICardProps {
  title: string;
  value: string | number;
  note?: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate";
}

const valueColor = {
  blue: "text-blue-600",
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  slate: "text-slate-900",
};

export default function KPICard({ title, value, note, tone = "slate" }: KPICardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <p className={`mt-3 text-3xl font-bold tabular-nums ${valueColor[tone]}`}>{value}</p>
      {note ? <p className="mt-1.5 text-xs text-slate-400">{note}</p> : null}
    </section>
  );
}
