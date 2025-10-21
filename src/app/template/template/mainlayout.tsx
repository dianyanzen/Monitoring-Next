"use client";

import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";

export default function TemplateLayoutClient({ children }: { children: React.ReactNode }) {
  return <ResponsiveAppShell>{children}</ResponsiveAppShell>;
}
