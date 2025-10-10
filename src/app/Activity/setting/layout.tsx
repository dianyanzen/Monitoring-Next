// 📄 src/app/Activity/setting/layout.tsx
import "../../globals.css";
import MainLayout from "./mainlayout";
import { SessionProvider } from "@/contexts/session";
import { readServerSession } from "@/lib/session";

export const metadata = {
  title: "Monalisa System - Dashboard",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 🔐 Ambil user dari cookie tersigned (server-side)
  const s = await readServerSession();

  return (
        <html lang="id" data-scroll-behavior="smooth">
      <head>
        <link
          rel="stylesheet"
          href="/assets/material-design-iconic-font/css/materialdesignicons.min.css"
        />
      </head>

      <body className="bg-[#0b0b0d] text-gray-100 min-h-screen overflow-x-hidden">
        <SessionProvider initialUser={s ?? null}>
          <MainLayout>{children}</MainLayout>
        </SessionProvider>
      </body>
    </html>
  );
}
