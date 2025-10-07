"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar dengan animasi buka/tutup */}
      {sidebarVisible && (
        <div className="h-full transition-all duration-300 ease-in-out">
          <Sidebar />
        </div>
      )}

      {/* Konten utama */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        <Topbar onToggleSidebar={() => setSidebarVisible(!sidebarVisible)} />

        {/* Konten scrollable */}
        <main className="flex-1 overflow-y-auto px-6 py-4">{children}</main>

        {/* Footer di bawah */}
        <Footer />
      </div>
    </div>
  );
}
