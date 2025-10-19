// 📄 src/app/dashboard/userktp/layout.tsx
import "../../../globals.css";
import "gridjs/dist/theme/mermaid.css";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - User Pencetakan E-KTP Detail",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await readServerSession();

  return (
    <SessionProvider initialUser={s ?? null}>
      {children}
    </SessionProvider>
  );
}