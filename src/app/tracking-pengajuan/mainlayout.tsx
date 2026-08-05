// FILE: src/app/tracking-pengajuan/mainlayout.tsx
"use client";

import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  return <ResponsiveAppShell>{children}</ResponsiveAppShell>;
}
