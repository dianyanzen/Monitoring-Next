import "../globals.css";
import "@/styles/components/pdak-upload.css";
import { SessionProvider } from "@/contexts/session";
import PdakAppShell from "@/components/pdak/PdakAppShell";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Upload Data PDAK",
  description: "Upload dan monitoring snapshot data PDAK",
};

export default async function PdakLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readServerSession();
  return (
    <SessionProvider initialUser={session ?? null}>
      <PdakAppShell>{children}</PdakAppShell>
    </SessionProvider>
  );
}
