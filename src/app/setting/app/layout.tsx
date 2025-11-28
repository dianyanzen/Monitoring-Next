// FILE: src/app/setting/app/layout.tsx
import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Setting App",
  description: "Pengaturan aplikasi monitoring | Disdukcapil Kota Bandung",
};

export default async function SettingAppLayout({
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
