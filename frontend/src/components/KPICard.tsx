type KPICardProps = {
  label: string;
  value: string | number;
  delta?: string;
  highlight?: boolean;
};

export default function KPICard({ label, value, delta, highlight = false }: KPICardProps) {
  const isPositive = delta?.trim().startsWith("+");

  return (
    <section className="rounded-2xl bg-navy p-6 text-cream shadow-sm">
      <div className={`font-black ${highlight ? "text-6xl text-amber" : "text-5xl"}`}>
        {value}
      </div>
      <div className="mt-3 text-sm font-bold uppercase tracking-normal opacity-70">{label}</div>
      {delta ? (
        <div className={`mt-4 text-sm font-bold ${isPositive ? "text-sage" : "text-cream/80"}`}>
          {delta}
        </div>
      ) : null}
    </section>
  );
}
