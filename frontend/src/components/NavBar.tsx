"use client";

import { useEffect, useState } from "react";

type NavItem = {
  label: string;
  view: string;
};

const navItems: NavItem[] = [
  { label: "Overview", view: "overview" },
  { label: "SKU Explorer", view: "sku-explorer" },
  { label: "Insights", view: "insights" },
  { label: "Model Performance", view: "model-performance" },
];

export default function NavBar() {
  const [activeView, setActiveView] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveView(params.get("view") ?? "overview");
  }, []);

  return (
    <header className="border-b border-navy/10 bg-cream/95 px-6 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <a href="/?view=overview" className="text-2xl font-black tracking-normal text-navy">
          RDI
        </a>
        <nav aria-label="Dashboard views" className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive = activeView === item.view;

            return (
              <a
                key={item.view}
                href={`/?view=${item.view}`}
                onClick={() => setActiveView(item.view)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  isActive ? "bg-navy text-cream" : "text-navy hover:bg-navy/10"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <button className="rounded-full bg-amber px-5 py-2 text-sm font-black text-navy shadow-sm transition hover:brightness-95">
          BYOK
        </button>
      </div>
    </header>
  );
}
