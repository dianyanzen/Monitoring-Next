import "../../globals.css";
import MainLayoutClient from "../ktpel/mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Duplicate Monitoring",
  description: "Monitoring duplicate NIK KTP-el",
};

export default async function DuplicateLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();

  return (
    <SessionProvider initialUser={session ?? null}>
      <MainLayoutClient>{children}</MainLayoutClient>
    </SessionProvider>
  );
}
