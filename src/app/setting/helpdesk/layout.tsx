import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Helpdesk Setting",
  description: "Manajemen helpdesk | Disdukcapil Kota Bandung",
};

export default async function SettingHelpdeskLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();
  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayout>{children}</MainLayout>
    </SessionProvider>
  );
}

