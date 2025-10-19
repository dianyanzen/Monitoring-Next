import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Master Contact",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default async function RootLayout({
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
