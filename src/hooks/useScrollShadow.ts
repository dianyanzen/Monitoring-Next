// FILE: src/hooks/useScrollShadow.ts
"use client";
import { useEffect } from "react";

export function useScrollShadow(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => {
      const scrolled = el.scrollTop > 0 ? "1" : "0";
      el.setAttribute("data-scrolled", scrolled);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);
}