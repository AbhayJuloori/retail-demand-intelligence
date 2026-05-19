"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const modelRows = [
  { model: "Prophet", rmse: 2.4, wrmsse: 0.68, notes: "weekly seasonality" },
  { model: "LightGBM", rmse: 1.9, wrmsse: 0.61, notes: "feature-rich" },
  { model: "Ensemble", rmse: 1.7, wrmsse: 0.57, notes: "blended" },
];

export default function ModelPerformance() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-black uppercase tracking-normal text-amber">Model Performance</p>
        <h1 className="mt-2 text-4xl font-black lg:text-6xl">Forecast Backtesting</h1>
      </section>

      <section className="overflow-hidden rounded-2xl border border-navy/10 bg-cream">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-navy text-cream">
              <tr>
                <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">Model</th>
                <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">Val RMSE</th>
                <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">WRMSSE</th>
                <th className="px-5 py-4 text-xs font-black uppercase tracking-normal">Notes</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((row) => (
                <tr key={row.model} className="border-b border-navy/10 last:border-b-0">
                  <td className="px-5 py-4 font-black">{row.model}</td>
                  <td className="px-5 py-4">{row.rmse.toFixed(1)}</td>
                  <td className="px-5 py-4 font-bold">{row.wrmsse.toFixed(2)}</td>
                  <td className="px-5 py-4">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-navy/10 bg-cream p-6 text-navy">
        <h2 className="text-2xl font-black">WRMSSE Comparison</h2>
        <div className="mt-5 h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modelRows} margin={{ top: 8, right: 10, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#1B2340" strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="model" tick={{ fill: "#1B2340", fontSize: 12, fontWeight: 700 }} />
              <YAxis tick={{ fill: "#1B2340", fontSize: 12 }} width={36} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#F5F0EB",
                  border: "1px solid rgba(27, 35, 64, 0.18)",
                  borderRadius: "12px",
                  color: "#1B2340",
                }}
              />
              <Bar dataKey="wrmsse" name="WRMSSE" fill="#1B2340" radius={[12, 12, 0, 0]}>
                <LabelList dataKey="wrmsse" position="insideTop" fill="#F5F0EB" fontWeight={900} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
