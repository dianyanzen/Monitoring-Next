// FILE: src/app/tracking-pengajuan/layout.tsx
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Tracking Pengajuan",
  description: "Tracking pengajuan pelayanan Disdukcapil Kota Bandung",
};

export default async function RootLayout({
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
