// 📄 src/app/dashboard/userktp/mainlayout.tsx
"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Footer from "@/components/layout/Footer";
import RouteChangeOverlay from "@/components/system/RouteChangeOverlay";

export default function userKtpLayoutUser({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Overlay route-change global */}
      <RouteChangeOverlay />
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
