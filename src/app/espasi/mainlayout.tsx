"use client";

import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";
import { usePathname } from "next/navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Keep Espasi dashboard fully fullscreen (without global app shell chrome).
  if (pathname?.startsWith("/espasi/dashboard") && pathname !== "/espasi/dashboard-sms") {
    return <>{children}</>;
  }

  return <ResponsiveAppShell>{children}</ResponsiveAppShell>;
}
