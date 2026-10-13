"use client";
import { useEffect, useRef } from "react";
import ResponsiveAppShell from "@/components/layout/ResponsiveAppShell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UploadCloud, Table2, Trophy } from "lucide-react";
export default function PdakAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const topbar = document.querySelector("header.fixed.top-0");
    if (!topbar) return;
    const update = () =>
      wrapper.current?.style.setProperty(
        "--pdak-topbar-height",
        `${topbar.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(topbar);
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={wrapper} className="pdak-shell">
      <ResponsiveAppShell mainClassName="pdak-shell-main flex-1 overflow-y-auto px-6 py-4">
        <nav className="pdak-workspace-nav" aria-label="Menu PDAK">
          {[
            { href: "/pdak/upload", label: "Upload PDAK", icon: UploadCloud },
            { href: "/pdak/data", label: "Data PDAK", icon: Table2 },
            { href: "/pdak/ikd/ranking", label: "Klasemen IKD", icon: Trophy },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
            >
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
        {children}
      </ResponsiveAppShell>
    </div>
  );
}
