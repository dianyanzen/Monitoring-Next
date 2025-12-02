import "../globals.css";
import MainLayoutClient from "../laporan_cetak/mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Laporan Kedatangan",
  description: "Disdukcapil Kota Bandung | Laporan Pindah Datang",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await readServerSession();
  return (
    <SessionProvider initialUser={s ?? null}>
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}
