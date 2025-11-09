// 📄 src/app/setting/user/change/[code]/layout.tsx
import "../../../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - User Level Setting",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await readServerSession();

  return (
      <SessionProvider initialUser={s ?? null}>
        {/* Semua styling/scroll di-handle oleh client layout */}
        <MainLayout>{children}</MainLayout>
      </SessionProvider>
  );
}
