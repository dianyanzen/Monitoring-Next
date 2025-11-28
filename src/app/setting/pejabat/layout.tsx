import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Setting Pejabat",
  description: "Manajemen pejabat pembina | Disdukcapil Kota Bandung",
};

export default async function SettingPejabatLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();
  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayout>{children}</MainLayout>
    </SessionProvider>
  );
}

