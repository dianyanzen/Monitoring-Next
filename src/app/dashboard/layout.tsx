// 📄 src/app/dashboard/layout.tsx
import "../globals.css";
import DashboardLayoutClient from "./DashboardLayoutClient";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Dashboard",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await readServerSession();

  return (
    <main className="dashboard-root">
    <SessionProvider initialUser={s ?? null}>
      {/* Semua styling/scroll di-handle oleh client layout */}
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </SessionProvider>
    </main>
  );
}
