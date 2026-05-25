import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar, TopBar } from "../components/Sidebar";

export const metadata = {
  title: "Demand Intel",
  description: "Retail demand intelligence dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-white">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="ml-[240px] flex min-h-screen flex-col bg-white">
            <Suspense fallback={null}>
              <TopBar />
            </Suspense>
            <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
