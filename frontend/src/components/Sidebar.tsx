"use client";

import { useSearchParams } from "next/navigation";

const navItems = [
  {
    label: "Overview",
    view: "overview",
    icon: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  },
  {
    label: "SKU Explorer",
    view: "sku-explorer",
    icon: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z",
  },
  {
    label: "Insights",
    view: "insights",
    icon: "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1Zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7Z",
  },
  {
    label: "Model Metrics",
    view: "model-metrics",
    icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2ZM9 17H7v-7h2v7Zm4 0h-2V7h2v10Zm4 0h-2v-4h2v4Z",
  },
  {
    label: "Simulation",
    view: "simulation",
    icon: "M8 5v14l11-7L8 5Z",
  },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

export function Sidebar() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "overview";

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[220px] flex-col border-r border-slate-800 bg-slate-900">
      {/* Wordmark */}
      <div className="flex h-14 items-center border-b border-slate-800 px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500">
            <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 18.5l6-6 4 4L22 6.92" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">Demand Intel</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4" aria-label="Main navigation">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Dashboard
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = currentView === item.view;
            return (
              <li key={item.view}>
                <a
                  href={`/?view=${item.view}`}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-slate-800 font-medium text-white"
                      : "font-normal text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  <NavIcon path={item.icon} />
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-5 py-4">
        <p className="text-[11px] leading-4 text-slate-500">
          M5 Walmart · 30,490 SKUs
          <br />
          Prophet + LightGBM ensemble
        </p>
      </div>
    </aside>
  );
}

export function TopBar() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "overview";
  const active = navItems.find((item) => item.view === currentView) ?? navItems[0];

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-8">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="text-slate-400">Dashboard</span>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-900">{active.label}</span>
      </div>
    </header>
  );
}
