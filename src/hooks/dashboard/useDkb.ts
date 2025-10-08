// FILE: src/hooks/dashboard/useDkb.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export type TDkbRow = {
  DKB: number;     
  R1: number;      
  R2: number;      
  JUMLAH: number;  
};

export function useDkb() {
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [ref, setRef]       = useState<string | null>(null);
  const [rows, setRows]     = useState<TDkbRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [r1, r2] = await Promise.all([
          fetch("/api/dashboard/dkb/ref", {
            cache: "no-store",
            signal: controller.signal,
          }).then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/dkb/summary", {
            cache: "no-store",
            signal: controller.signal,
          }).then(r => r.json()).catch(() => ({})),
        ]);

        if (r1?.success && r1?.data?.dkb) {
          setRef(String(r1.data.dkb));
        } else {
          setRef(null);
        }

        if (r2?.success && Array.isArray(r2?.data?.rows)) {
          const parsed: TDkbRow[] = r2.data.rows.map((x: any) => ({
            DKB: Number(x.DKB) || 0,
            R1: Number(x.R1) || 0,
            R2: Number(x.R2) || 0,
            JUMLAH: Number(x.JUMLAH) || 0,
          }));
          setRows(parsed);
        } else {
          setRows([]);
        }
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e.message || "Gagal memuat DKB");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const latest = useMemo(() => rows?.[0] ?? null, [rows]);

  const total = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          R1: acc.R1 + r.R1,
          R2: acc.R2 + r.R2,
          JUMLAH: acc.JUMLAH + r.JUMLAH,
        }),
        { R1: 0, R2: 0, JUMLAH: 0 }
      ),
    [rows]
  );

  return { loading, error, ref, rows, latest, total };
}
