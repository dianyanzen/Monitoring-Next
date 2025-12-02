import "../globals.css";
import MainLayoutClient from "../laporan_cetak/mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Laporan BNBA Kematian",
  description: "Disdukcapil Kota Bandung | Laporan Akta Kematian",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await readServerSession();
  return (
    <SessionProvider initialUser={s ?? null}>
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}
