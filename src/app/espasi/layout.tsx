import "../globals.css";
import "../../styles/espasi-sms.css";
import "../../styles/espasi-loket.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Espasi",
  description: "Menu Espasi terintegrasi di monitoring-next.",
};

export default async function EspasiLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();

  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayout>{children}</MainLayout>
    </SessionProvider>
  );
}
