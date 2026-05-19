"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ForecastPoint = {
  date: string;
  actual?: number;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
};

type ForecastChartProps = {
  data: ForecastPoint[];
};

type ChartPoint = ForecastPoint & {
  uncertainty: number;
};

export default function ForecastChart({ data }: ForecastChartProps) {
  const chartData: ChartPoint[] = data.map((point) => ({
    ...point,
    uncertainty: Math.max(point.yhat_upper - point.yhat_lower, 0),
  }));

  return (
    <div className="h-[300px] rounded-2xl bg-cream p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#1B2340" strokeDasharray="3 3" opacity={0.12} />
          <XAxis dataKey="date" tick={{ fill: "#1B2340", fontSize: 12 }} tickMargin={8} />
          <YAxis tick={{ fill: "#1B2340", fontSize: 12 }} width={36} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#F5F0EB",
              border: "1px solid rgba(27, 35, 64, 0.18)",
              borderRadius: "12px",
              color: "#1B2340",
            }}
          />
          <Legend />
          <Area
            dataKey="yhat_lower"
            stackId="forecast-band"
            stroke="none"
            fill="#1B2340"
            fillOpacity={0}
            legendType="none"
          />
          <Area
            name="Uncertainty"
            dataKey="uncertainty"
            stackId="forecast-band"
            stroke="none"
            fill="#1B2340"
            fillOpacity={0.2}
          />
          <Line
            name="Predicted"
            type="monotone"
            dataKey="yhat"
            stroke="#1B2340"
            strokeWidth={3}
            dot={false}
          />
          <Line
            name="Actual"
            type="monotone"
            dataKey="actual"
            stroke="#D4A017"
            strokeWidth={3}
            strokeDasharray="6 6"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { AreaChart };
