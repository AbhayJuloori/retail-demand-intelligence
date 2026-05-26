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
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import StatusBadge from "../components/StatusBadge";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const TOTAL_DAYS = 90;
const STARTING_STOCK = 180;
const AVG_DEMAND = 7;
const LEAD_TIME = 7;
const REORDER_POINT = 75;
const SAFETY_STOCK = 26;
const EOQ = 120;
const SKU_ID = "FOODS_3_090_CA_1";

interface EventLog {
  day: number;
  text: string;
  tone: "green" | "amber" | "red" | "purple";
}

interface SimState {
  day: number;
  stock: number;
  baselineStock: number;
  pendingOrderDay: number | null;
  orderReceived: boolean;
  stockoutPrevented: boolean;
  series: number[];
  events: EventLog[];
}

const initialState: SimState = {
  day: 0,
  stock: STARTING_STOCK,
  baselineStock: STARTING_STOCK,
  pendingOrderDay: null,
  orderReceived: false,
  stockoutPrevented: false,
  series: [],
  events: [],
};

const zonesPlugin = {
  id: "inventory-zones",
  beforeDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    const yScale = scales.y;
    if (!chartArea || !yScale) return;

    const top = chartArea.top;
    const bottom = chartArea.bottom;
    const safetyY = Math.min(bottom, Math.max(top, yScale.getPixelForValue(SAFETY_STOCK)));
    const reorderY = Math.min(bottom, Math.max(top, yScale.getPixelForValue(REORDER_POINT)));

    ctx.save();
    ctx.fillStyle = "rgba(22, 163, 74, 0.08)";
    ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, reorderY - top);
    ctx.fillStyle = "rgba(217, 119, 6, 0.1)";
    ctx.fillRect(chartArea.left, reorderY, chartArea.right - chartArea.left, safetyY - reorderY);
    ctx.fillStyle = "rgba(220, 38, 38, 0.08)";
    ctx.fillRect(chartArea.left, safetyY, chartArea.right - chartArea.left, bottom - safetyY);
    ctx.restore();
  },
};

export default function Simulation() {
  const [state, setState] = useState<SimState>(initialState);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || state.day >= TOTAL_DAYS) return;
    const id = window.setInterval(() => {
      setState((current) => step(current));
    }, 50);
    return () => window.clearInterval(id);
  }, [playing, state.day]);

  useEffect(() => {
    if (state.day >= TOTAL_DAYS) setPlaying(false);
  }, [state.day]);

  const status = state.stock > REORDER_POINT ? "OK" : state.stock > SAFETY_STOCK ? "AT RISK" : "STOCKOUT IMMINENT";
  const labels = useMemo(() => Array.from({ length: TOTAL_DAYS }, (_, index) => `Day ${index + 1}`), []);
  const markerData = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, index) => {
        const event = state.events.find((item) => item.day === index + 1);
        return event ? state.series[index] ?? null : null;
      }),
    [state.events, state.series],
  );
  const markerColors = useMemo(
    () =>
      labels.map((_, index) => {
        const event = state.events.find((item) => item.day === index + 1);
        if (event?.tone === "green") return "#16A34A";
        if (event?.tone === "amber") return "#D97706";
        if (event?.tone === "red") return "#DC2626";
        return "#7C3AED";
      }),
    [labels, state.events],
  );

  return (
    <>
      <div className="mb-5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-5">
        <h2 className="text-lg font-semibold text-[#1D4ED8]">Real-Time Inventory Simulation</h2>
        <p className="mt-2 text-sm leading-6 text-[#1E40AF]">
          Watch how the demand forecasting model prevents a stockout in real time. As daily sales deplete stock, the model fires an alert when inventory
          crosses the reorder point (75 units). An order is placed and arrives after a 7-day supplier lead time — right before a holiday demand spike would
          have caused a stockout. Press <strong>Play</strong> to run the 90-day simulation.
        </p>
        <div className="mt-3 flex gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#2563EB]"></span>Stock Level
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#D97706]"></span>Reorder Point (75u)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#DC2626]"></span>Safety Stock (26u)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#7C3AED]"></span>Holiday Spike (Day 22–26)
          </span>
        </div>
      </div>

      <div className="space-y-5">
        <section className="grid grid-cols-[3fr_2fr] gap-5">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">{SKU_ID}</h2>
                <p className="mt-1 text-sm text-[#64748B]">90-day inventory journey with lead-time reorder simulation.</p>
              </div>
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-sm font-semibold text-[#2563EB]">Lead Time: {LEAD_TIME} days</span>
            </div>
            <div className="h-[500px]">
              <Line
                data={{
                  labels,
                  datasets: [
                    {
                      label: "Actual Stock Level",
                      data: labels.map((_, index) => state.series[index] ?? null),
                      borderColor: "#2563EB",
                      backgroundColor: "#2563EB",
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.25,
                    },
                    {
                      label: "Reorder Point",
                      data: labels.map(() => REORDER_POINT),
                      borderColor: "#D97706",
                      borderDash: [6, 6],
                      borderWidth: 2,
                      pointRadius: 0,
                    },
                    {
                      label: "Safety Stock",
                      data: labels.map(() => SAFETY_STOCK),
                      borderColor: "#DC2626",
                      borderDash: [6, 6],
                      borderWidth: 2,
                      pointRadius: 0,
                    },
                    {
                      label: "Event Marker",
                      data: markerData,
                      borderColor: "transparent",
                      backgroundColor: markerColors,
                      showLine: false,
                      pointRadius: 6,
                      pointHoverRadius: 8,
                    },
                  ],
                }}
                plugins={[zonesPlugin]}
                options={{
                  maintainAspectRatio: false,
                  animation: false,
                  interaction: { intersect: false, mode: "index" },
                  plugins: {
                    legend: { labels: { color: "#64748B" } },
                    tooltip: {
                      callbacks: {
                        afterBody(items) {
                          const day = items[0]?.dataIndex + 1;
                          const event = state.events.find((item) => item.day === day);
                          return event ? event.text : "";
                        },
                      },
                    },
                  },
                  scales: {
                    x: { ticks: { color: "#64748B", maxTicksLimit: 12 }, grid: { color: "#F1F5F9" } },
                    y: { suggestedMin: 0, suggestedMax: 220, ticks: { color: "#64748B" }, grid: { color: "#E2E8F0" } },
                  },
                }}
              />
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button className="rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white" onClick={() => setPlaying((value) => !value)}>
                {playing ? "Pause" : "Play"}
              </button>
              <button
                className="rounded-lg border border-[#E2E8F0] bg-white px-5 py-2 text-sm font-semibold text-[#0F172A]"
                onClick={() => {
                  setPlaying(false);
                  setState(initialState);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <aside className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <InfoTile label="Current Day" value={`${state.day} / ${TOTAL_DAYS}`} />
              <InfoTile label="Current Stock" value={`${Math.round(state.stock)} units`} />
            </div>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <span className="text-sm font-semibold text-[#64748B]">Status</span>
              <StatusBadge status={status} />
            </div>
            {state.stockoutPrevented ? (
              <div className="mt-4 rounded-xl border border-[#BBF7D0] bg-[#DCFCE7] px-4 py-3 text-sm font-bold text-[#166534]">Stockout Prevented ✓</div>
            ) : null}
            <div className="mt-5">
              <h3 className="font-semibold text-[#0F172A]">Events Log</h3>
              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto">
                {state.events.length === 0 ? <p className="text-sm text-[#64748B]">No events fired yet.</p> : null}
                {state.events.map((event, index) => (
                  <div key={`${event.day}-${index}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]">
                    Day {event.day}: {event.text}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#0F172A]">{value}</p>
    </div>
  );
}

function demandForDay(day: number) {
  if (day >= 22 && day <= 26) return 20;
  const noise = [-2, -1, 0, 1, 2][day % 5];
  return AVG_DEMAND + noise;
}

function appendEvent(events: EventLog[], day: number, text: string, tone: EventLog["tone"]) {
  if (events.some((event) => event.day === day && event.text === text)) return events;
  return [...events, { day, text, tone }];
}

function step(current: SimState): SimState {
  if (current.day >= TOTAL_DAYS) return current;

  const day = current.day + 1;
  const demand = demandForDay(day);
  let stock = Math.max(0, current.stock - demand);
  const baselineStock = current.baselineStock - demand;
  let pendingOrderDay = current.pendingOrderDay;
  let orderReceived = current.orderReceived;
  let stockoutPrevented = current.stockoutPrevented || (orderReceived && baselineStock < 0);
  let events = current.events;

  if (day === 22) events = appendEvent(events, day, "Holiday demand spike started", "purple");
  if (day === 27) events = appendEvent(events, day, "Holiday demand spike ended", "purple");

  if (pendingOrderDay !== null && day === pendingOrderDay + LEAD_TIME) {
    stock += EOQ;
    pendingOrderDay = null;
    orderReceived = true;
    events = appendEvent(events, day, `Order received +${EOQ} units`, "green");
  }

  if (stock <= REORDER_POINT && pendingOrderDay === null && stock > 0) {
    pendingOrderDay = day;
    events = appendEvent(events, day, "Model alert fired", "amber");
  }

  if (!stockoutPrevented && orderReceived && baselineStock < 0) {
    stockoutPrevented = true;
    events = appendEvent(events, day, "Stockout prevented by model reorder", "green");
  }

  if (stock === 0) {
    events = appendEvent(events, day, "Stockout imminent threshold reached", "red");
  }

  return {
    day,
    stock,
    baselineStock,
    pendingOrderDay,
    orderReceived,
    stockoutPrevented,
    series: [...current.series, stock],
    events,
  };
}
