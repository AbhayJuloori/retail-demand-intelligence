"use client";

import { useSearchParams } from "next/navigation";

const navItems = [
  { label: "Overview", view: "overview", icon: "M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Zm10 0h6v-7h-6v7Z" },
  { label: "Inventory", view: "inventory", icon: "M4 5h16v4H4V5Zm0 6h16v8H4v-8Zm3 2v4h10v-4H7Z" },
  { label: "SKU Explorer", view: "sku-explorer", icon: "M10 4a6 6 0 0 1 4.8 9.6l4.3 4.3-1.4 1.4-4.3-4.3A6 6 0 1 1 10 4Zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { label: "Insights", view: "insights", icon: "M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Zm-2 18h4v-2h-4v2Z" },
  { label: "Model Metrics", view: "model-metrics", icon: "M4 19h16v2H4v-2Zm2-2V9h3v8H6Zm5 0V4h3v13h-3Zm5 0v-6h3v6h-3Z" },
  { label: "Simulation", view: "simulation", icon: "M8 5v14l11-7L8 5Z" },
];

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d={path} />
    </svg>
  );
}

export function Sidebar() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "overview";

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[240px] flex-col bg-[#0F172A] px-4 py-6 text-white">
      <div className="px-3 text-xl font-bold tracking-tight">Demand Intel</div>
      <nav className="mt-8 flex flex-col gap-2">
        {navItems.map((item) => {
          const active = currentView === item.view;
          return (
            <a
              key={item.view}
              href={`/?view=${item.view}`}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-[#2563EB] text-white" : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-white"
              }`}
            >
              <Icon path={item.icon} />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export function TopBar() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "overview";
  const active = navItems.find((item) => item.view === currentView) ?? navItems[0];

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-8">
      <h1 className="text-xl font-bold text-[#0F172A]">{active.label}</h1>
      <span className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-sm font-semibold text-[#64748B]">
        API: Local
      </span>
    </header>
  );
}
