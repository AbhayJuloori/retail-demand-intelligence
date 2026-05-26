import type { ReactNode } from "react";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar, TopBar } from "../components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Demand Intel",
  description: "Retail demand intelligence dashboard — M5 Walmart forecasting",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <div className="min-h-screen bg-slate-50">
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <main className="ml-[220px] flex min-h-screen flex-col">
            <Suspense fallback={null}>
              <TopBar />
            </Suspense>
            <div className="flex-1 px-8 py-7">
              <div className="mx-auto max-w-[1200px]">{children}</div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
