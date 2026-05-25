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
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-[#64748B] shadow-sm">
        No SHAP feature importance data
      </div>
    );
  }

  return (
    <div className="h-[420px] rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-[#0F172A]">SHAP Feature Importance</h2>
      <Bar
        data={{
          labels: rows.map(([feature]) => feature),
          datasets: [
            {
              label: "Importance",
              data: rows.map(([, value]) => value),
              backgroundColor: "#2563EB",
              borderRadius: 6,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: "#64748B" }, grid: { color: "#E2E8F0" } },
            y: { ticks: { color: "#64748B" }, grid: { display: false } },
          },
        }}
      />
    </div>
  );
}
