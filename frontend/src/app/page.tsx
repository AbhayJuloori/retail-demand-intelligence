import type { ReactElement } from "react";
import InsightsFeed from "../views/InsightsFeed";
import ModelPerformance from "../views/ModelPerformance";
import Overview from "../views/Overview";
import SKUExplorer from "../views/SKUExplorer";

type ViewName = "overview" | "sku-explorer" | "insights" | "model-performance";

type HomeProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

const viewMap: Record<ViewName, ReactElement> = {
  overview: <Overview />,
  "sku-explorer": <SKUExplorer />,
  insights: <InsightsFeed />,
  "model-performance": <ModelPerformance />,
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const view = params?.view as ViewName | undefined;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-10 lg:px-10">
      {viewMap[view ?? "overview"] ?? <Overview />}
    </main>
  );
}
