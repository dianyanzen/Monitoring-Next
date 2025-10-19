// FILE: src/app/layout.tsx
import "./globals.css"; // <- sebelumnya "../globals.css" (salah path)
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Monalisa System", template: "%s — Monalisa System" },
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
      <body className="bg-[#0b0b0d] text-gray-100 min-h-screen overflow-x-hidden">{children}</body>
    </html>
  );
}
