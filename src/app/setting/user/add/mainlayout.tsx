// 📄 src/app/setting/userlevel/add/mainlayout.tsx
"use client";

import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";

export default function MainLayoutClient({ children }: { children: React.ReactNode }) {
  return <ResponsiveAppShell>{children}</ResponsiveAppShell>;
}
