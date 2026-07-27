import { SessionProvider } from "@/contexts/session";
import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "DUK AI - Monalisa System",
  description: "Asisten AI internal Disdukcapil Kota Bandung",
};

export default async function AiLayout({ children }: { children: React.ReactNode }) {
  const session = await readServerSession();

  return (
    <SessionProvider initialUser={session ?? null}>
      <ResponsiveAppShell mainClassName="flex-1 overflow-hidden">{children}</ResponsiveAppShell>
    </SessionProvider>
  );
}
