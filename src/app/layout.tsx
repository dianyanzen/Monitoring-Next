import "./globals.css";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export const metadata = {
  title: "Monitoring Futuristik",
  description: "Disdukcapil Kota Bandung | AI-powered Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b0b0d] text-gray-100 flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <div className="p-6 overflow-y-auto h-full">{children}</div>
        </main>
      </body>
    </html>
  );
}
