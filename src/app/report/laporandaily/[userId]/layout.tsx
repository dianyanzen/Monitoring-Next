import { readServerSession } from "@/lib/session";
import { SessionProvider } from "@/contexts/session";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await readServerSession();
  return <SessionProvider initialUser={s ?? null}>{children}</SessionProvider>;
}
