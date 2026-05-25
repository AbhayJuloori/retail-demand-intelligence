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
  const labels = forecast.map((row) => row.date);
  const data = {
    labels,
    datasets: [
      {
        label: "Confidence Lower",
        data: forecast.map((row) => row.yhat_lower),
        borderColor: "rgba(37, 99, 235, 0)",
        backgroundColor: "rgba(37, 99, 235, 0)",
        pointRadius: 0,
      },
      {
        label: "Confidence Band",
        data: forecast.map((row) => row.yhat_upper),
        borderColor: "rgba(37, 99, 235, 0)",
        backgroundColor: "rgba(37, 99, 235, 0.14)",
        fill: "-1",
        pointRadius: 0,
      },
      {
        label: "Blended Forecast",
        data: forecast.map((row) => row.blended ?? row.yhat),
        borderColor: "#2563EB",
        backgroundColor: "#2563EB",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="h-[340px] rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
      <Line
        data={data}
        options={{
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: {
              labels: {
                color: "#64748B",
                filter: (item) => item.text !== "Confidence Lower",
              },
            },
          },
          scales: {
            x: { ticks: { color: "#64748B", maxRotation: 0 }, grid: { color: "#F1F5F9" } },
            y: { ticks: { color: "#64748B" }, grid: { color: "#E2E8F0" } },
          },
        }}
      />
    </div>
  );
}
