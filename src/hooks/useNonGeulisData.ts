"use client";

import { useEffect, useState } from "react";

export type TWilayahData = {
  NO_WIL: string;
  NAMA_WIL: string;
  TOTAL_REKAM: number;
  TOTAL_CETAK: number;
  TOTAL_IKD: number;
  TOTAL_AKTE_17: number;
  TOTAL_KIA: number;
  TOTAL_JUMLAH: number;
};

/**
 * Hook untuk data NON-GEULIS (wilayah pelayanan reguler)
 * Endpoint: /api/dashboard/nongeulis
 */
export function useNonGeulisData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TWilayahData[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/nongeulis", { cache: "no-store" });
        const json = await res.json();

        if (!alive) return;

        if (json?.success && Array.isArray(json?.rows)) {
          setData(
            json.rows.map((r: any) => ({
              NO_WIL: r.NO_WIL,
              NAMA_WIL: r.NAMA_WIL,
              TOTAL_REKAM: Number(r.TOTAL_REKAM) || 0,
              TOTAL_CETAK: Number(r.TOTAL_CETAK) || 0,
              TOTAL_IKD: Number(r.TOTAL_IKD) || 0,
              TOTAL_AKTE_17: Number(r.TOTAL_AKTE_17) || 0,
              TOTAL_KIA: Number(r.TOTAL_KIA) || 0,
              TOTAL_JUMLAH: Number(r.TOTAL_JUMLAH) || 0,
            }))
          );
        } else {
          setData([]);
        }
      } catch {
        if (alive) setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading };
}
