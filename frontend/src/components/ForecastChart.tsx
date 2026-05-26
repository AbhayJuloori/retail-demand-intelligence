"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ForecastRow } from "../lib/types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function ForecastChart({ forecast }: { forecast: ForecastRow[] }) {
  if (forecast.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
        No forecast data
      </div>
    );
  }

  const labels = forecast.map((r) => {
    const d = new Date(r.date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  return (
    <div className="h-[280px]">
      <Line
        data={{
          labels,
          datasets: [
            {
              label: "Lower bound",
              data: forecast.map((r) => r.yhat_lower),
              borderColor: "transparent",
              backgroundColor: "transparent",
              pointRadius: 0,
              fill: false,
            },
            {
              label: "Confidence band",
              data: forecast.map((r) => r.yhat_upper),
              borderColor: "transparent",
              backgroundColor: "rgba(79, 70, 229, 0.08)",
              fill: "-1",
              pointRadius: 0,
            },
            {
              label: "Forecast",
              data: forecast.map((r) => r.blended ?? r.yhat),
              borderColor: "#4f46e5",
              backgroundColor: "#4f46e5",
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              tension: 0.35,
            },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          animation: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: {
              labels: {
                color: "#94a3b8",
                font: { size: 11 },
                usePointStyle: true,
                pointStyleWidth: 8,
                filter: (item) => item.text !== "Lower bound" && item.text !== "Confidence band",
              },
            },
            tooltip: {
              backgroundColor: "#0f172a",
              titleColor: "#94a3b8",
              bodyColor: "#f1f5f9",
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              ticks: {
                color: "#94a3b8",
                font: { size: 11 },
                maxRotation: 0,
                maxTicksLimit: 8,
              },
              grid: { color: "#f1f5f9" },
              border: { display: false },
            },
            y: {
              ticks: { color: "#94a3b8", font: { size: 11 } },
              grid: { color: "#f1f5f9" },
              border: { display: false },
            },
          },
        }}
      />
    </div>
  );
}
