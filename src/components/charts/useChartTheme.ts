// FILE: src/components/charts/useChartTheme.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export type ChartTheme = {
  grid: string; ticks: string; border: string; tooltipBg: string; tooltipFg: string;
};

export function useChartTheme(): ChartTheme {
  const [state, setState] = useState<ChartTheme>(() => ({
    grid: "rgba(148,163,184,.25)", ticks: "#cbd5e1", border: "rgba(148,163,184,.35)",
    tooltipBg: "rgba(15,23,42,.95)", tooltipFg: "#e5e7eb",
  }));

  useEffect(() => {
    const el = document.documentElement;
    const styles = getComputedStyle(el);
    const isLight = el.getAttribute("data-theme") === "light";
    const grid = isLight ? styles.getPropertyValue("--lux-border").trim() || "rgba(20,24,33,.14)" : "rgba(148,163,184,.25)";
    const ticks = isLight ? styles.getPropertyValue("--lux-ink").trim() || "#141821" : "#cbd5e1";
    const border = isLight ? styles.getPropertyValue("--lux-border").trim() || "rgba(20,24,33,.14)" : "rgba(148,163,184,.35)";
    const tooltipBg = isLight ? "rgba(255,255,255,.98)" : "rgba(15,23,42,.98)";
    const tooltipFg = isLight ? styles.getPropertyValue("--lux-ink").trim() || "#141821" : "#e5e7eb";
    setState({ grid, ticks, border, tooltipBg, tooltipFg });
  }, []);

  return state;
}