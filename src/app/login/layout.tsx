import "../globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Monitoring Futuristik",
  description: "Disdukcapil Kota Bandung | AI-powered Dashboard",
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
      <body className="bg-[#0b0b0d] text-gray-100 min-h-screen overflow-x-hidden">
        <div className="flex h-screen w-full overflow-hidden">
          {/* Sidebar tetap penuh tinggi */}

          {/* Konten utama */}
          <div className="flex flex-col flex-1 h-full overflow-hidden">
      

            {/* Konten scrollable */}
            <main className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </main>

            {/* Footer di bawah */}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
