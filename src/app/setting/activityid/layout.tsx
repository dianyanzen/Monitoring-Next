// FILE: src/app/setting/activityid/layout.tsx
import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Setting Activity",
  description: "Kelola daftar activity ID & grup user | Disdukcapil Kota Bandung",
};

export default async function SettingActivityIdLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();
  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayout>{children}</MainLayout>
    </SessionProvider>
  );
}

