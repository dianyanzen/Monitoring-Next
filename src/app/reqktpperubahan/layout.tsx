// FILE: src/app/reqktpperubahan/layout.tsx
import "../globals.css";
import MainLayoutClient from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Request KTP Perubahan",
  description: "Disdukcapil Kota Bandung | Request Cetak eKTP (Perubahan Elemen)",
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
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}

