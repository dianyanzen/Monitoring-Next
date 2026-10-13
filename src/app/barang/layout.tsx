import "../globals.css";
import MainLayoutClient from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Modul Barang",
  description: "Disdukcapil Kota Bandung | Kendali master & stok barang",
};

export default async function BarangLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await readServerSession();
  return (
    <SessionProvider initialUser={s ?? null}>
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}

import "@/styles/components/operational-workspace.css";
