import "../../globals.css";
import MainLayoutClient from "../ktpel/mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Monitoring Duplicate Record KTP-El",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default async function DuplicateLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();

  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}
