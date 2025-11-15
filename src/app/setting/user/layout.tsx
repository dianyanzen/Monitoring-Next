// FILE: src/app/setting/user/layout.tsx
import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Setting User",
  description: "Monitoring user management | Disdukcapil Kota Bandung",
};

export default async function SettingUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readServerSession();

  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayout>{children}</MainLayout>
    </SessionProvider>
  );
}
