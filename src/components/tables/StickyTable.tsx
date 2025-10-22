// FILE: src/components/tables/StickyTable.tsx
"use client";
import { useRef } from "react";
import { useScrollShadow } from "@/hooks/useScrollShadow";

export default function StickyTable({ children, className }: { children: React.ReactNode; className?: string }){
  const wrapRef = useRef<HTMLDivElement>(null);
  useScrollShadow(wrapRef);
  return (
    <div ref={wrapRef} className={`sticky-table ${className || ""}`}>
      <div className="sticky-table__shadow" />
      {children}
    </div>
  );
}