"use client";

import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <ResponsiveAppShell>{children}</ResponsiveAppShell>;
}

