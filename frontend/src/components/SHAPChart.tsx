"use client";

import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function SHAPChart({ importance }: { importance: Record<string, number> }) {
  const rows = Object.entries(importance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (rows.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400 shadow-sm">
        No SHAP feature importance data available
      </div>
    );
  }

  const maxVal = rows[0][1];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Feature Importance</h2>
      <p className="mt-0.5 text-xs text-slate-400">
        Top 10 features by mean absolute SHAP value — higher means more influence on forecast accuracy.
      </p>
      <div className="mt-5 h-[320px]">
        <Bar
          data={{
            labels: rows.map(([feature]) =>
              feature.replace(/_/g, " ").replace(/lag (\d+)/, "lag-$1 day"),
            ),
            datasets: [
              {
                label: "SHAP importance",
                data: rows.map(([, value]) => value),
                backgroundColor: rows.map(([, value]) => {
                  const pct = value / maxVal;
                  return pct > 0.7 ? "#4f46e5" : pct > 0.4 ? "#6366f1" : "#a5b4fc";
                }),
                borderRadius: 4,
                borderSkipped: false,
              },
            ],
          }}
          options={{
            indexAxis: "y",
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "#0f172a",
                titleColor: "#94a3b8",
                bodyColor: "#f1f5f9",
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: (ctx) => ` ${(ctx.raw as number).toFixed(4)}`,
                },
              },
            },
            scales: {
              x: {
                ticks: { color: "#94a3b8", font: { size: 11 } },
                grid: { color: "#f1f5f9" },
                border: { display: false },
              },
              y: {
                ticks: { color: "#64748b", font: { size: 11 } },
                grid: { display: false },
                border: { display: false },
              },
            },
          }}
        />
      </div>
    </section>
  );
}
