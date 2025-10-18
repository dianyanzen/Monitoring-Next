import "../globals.css";
import Footer from "@/components/layout/Footer";

export const metadata = {
  title: "Monalisa System - Login",
  description: "Disdukcapil Kota Bandung | AI-powered System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="/assets/material-design-iconic-font/css/materialdesignicons.min.css"
        />
      </head>
      {/* ❌ Hapus overflow-auto di <main> agar login tidak scroll */}
      <body className="bg-[#0b0b0d] text-gray-100 min-h-screen overflow-hidden">
        <div className="flex h-screen w-full">
          <div className="flex flex-col flex-1 h-full">
            <main className="flex-1 h-full">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
