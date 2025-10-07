"use client";
import { useEffect, useMemo, useState } from "react";

type TDkbRow = { DKB: string; R1: number; R2: number; JUMLAH: number };

export function useDkb() {
  const [loading, setLoading] = useState(true);
  const [ref, setRef] = useState<string | null>(null);
  const [rows, setRows] = useState<TDkbRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [r1, r2] = await Promise.all([
          fetch("/api/dashboard/dkb/ref").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/dkb/summary").then(r => r.json()).catch(() => ({})),
        ]);

        if (!alive) return;
        if (r1?.success) setRef(r1.dkb ?? null);
        if (r2?.success) setRows(Array.isArray(r2.rows) ? r2.rows : []);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  const latest = useMemo(() => rows?.[0] ?? null, [rows]);
  const total = useMemo(() => {
    const s = rows.reduce(
      (acc, r) => {
        acc.R1 += Number(r.R1 || 0);
        acc.R2 += Number(r.R2 || 0);
        acc.JUMLAH += Number(r.JUMLAH || 0);
        return acc;
      },
      { R1: 0, R2: 0, JUMLAH: 0 }
    );
    return s;
  }, [rows]);

  return { loading, ref, rows, latest, total };
}
