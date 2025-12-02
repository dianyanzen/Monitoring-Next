// FILE: src/app/layout.tsx
import "./globals.css"; // <- sebelumnya "../globals.css" (salah path)
// ⬇️ Global CSS modular (urutkan dari tokens → themes → layout → overlays → util → halaman/komponen)
import "../styles/tokens.css";
import "../styles/theme-dark.css";
import "../styles/theme-light.css";
import "../styles/fallbacks.css";
import "../styles/layout.css";
import "../styles/overlays.css";
import "../styles/utilities.css";
import "../styles/ktpel.css";
import "../styles/components/salaman-card.css";
import "../styles/components/chat-cp.css";

/* ⬇️ Batch-2 */
import "../styles/components/tables.css";
import "../styles/components/forms.css";
import "../styles/dashboard.css";
import "../styles/master.css";

// Batch 3
import "../styles/components/cards-kpi.css";
import "../styles/components/charts.css";
import "../styles/components/sticky-table.css";
import "../styles/components/badges.css";
import "../styles/components/progress.css";
import "../styles/components/daterange.css";

// Batch 4
import "../styles/components/topbar.css";
import "../styles/components/sidebar.css";
import "../styles/print.css"; // global agar semua halaman punya mode cetak

// Batch 5
import "../styles/components/modal.css";
import "../styles/components/toast.css";
import "../styles/components/forms-states.css";
import "../styles/components/select-dark.css"; // setelah theme-dark.css & sebelum theme-light.css tidak masalah, tapi idealnya setelah keduanya
import "../styles/components/date-range-dark.css";


import type { Metadata } from "next";
import GlobalFetchOverlay from "@/components/system/GlobalFetchOverlay";

export const metadata: Metadata = {
  title: { default: "Monalisa System", template: "%s — Disdukcapil Kota Bandung" },
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var path=location.pathname||'';var stored=localStorage.getItem('theme');var preferred=stored==='light'?'light':'dark';var mode=path.startsWith('/login')?'dark':preferred;d.dataset.theme=mode;if(mode==='dark'){d.classList.add('dark');}else{d.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
        <link
          rel="stylesheet"
          href="/assets/material-design-iconic-font/css/materialdesignicons.min.css"
        />
      </head>
      <body className="bg-[#0b0b0d] text-gray-100 min-h-screen overflow-x-hidden">
        <GlobalFetchOverlay key="global-fetch-overlay-v2" />
        {children}
      </body>
    </html>
  );
}
