"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import InsightsFeed from "../views/InsightsFeed";
import ModelMetrics from "../views/ModelMetrics";
import Overview from "../views/Overview";
import Simulation from "../views/Simulation";
import SKUExplorer from "../views/SKUExplorer";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageContent />
    </Suspense>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "overview";

  if (view === "sku-explorer") return <SKUExplorer />;
  if (view === "insights") return <InsightsFeed />;
  if (view === "model-metrics") return <ModelMetrics />;
  if (view === "simulation") return <Simulation />;

  return <Overview />;
}
