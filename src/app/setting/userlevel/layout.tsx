// 📄 src/app/setting/userlevel/layout.tsx
import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Setting User Level",
  description: "Manajemen level user | Disdukcapil Kota Bandung",
};

export default async function SettingUserLevelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await readServerSession();

  return (
      <SessionProvider initialUser={s ?? null}>
        {/* Semua styling/scroll di-handle oleh client layout */}
        <MainLayout>{children}</MainLayout>
      </SessionProvider>
  );
}
