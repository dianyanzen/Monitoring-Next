"use client";
import { useEffect, useState } from "react";
import type { CapaianRow } from "@/lib/dashboard/capaian";
export function useCapaian() {
  const [date, setDate] = useState(""),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [rows, setRows] = useState<CapaianRow[]>([]),
    [dates, setDates] = useState<string[]>([]),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/dashboard/capaian${date ? `?date=${date}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const json = await res.json();
        if (!res.ok || !json.success)
          throw new Error(json.message || "Gagal memuat capaian.");
        if (!controller.signal.aborted) {
          setRows(json.data.rows);
          setDates(json.data.dates);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setRows([]);
          setError(e instanceof Error ? e.message : "Gagal memuat capaian.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [date, revision]);
  return {
    loading,
    rows,
    dates,
    date,
    setDate,
    error,
    refresh: () => setRevision((r) => r + 1),
  };
}
