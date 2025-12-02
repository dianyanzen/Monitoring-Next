import "../globals.css";
import MainLayoutClient from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Cetak Dinas",
  description: "Disdukcapil Kota Bandung | Kendali Cetak Dinas",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await readServerSession();
  return (
    <SessionProvider initialUser={s ?? null}>
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}
