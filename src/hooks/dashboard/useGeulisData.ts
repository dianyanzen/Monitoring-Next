// FILE: src/hooks/dashboard/useGeulisData.ts
"use client";

import { useEffect, useMemo, useState } from "react";

export type TWilayahData = {
  NO_WIL: number;
  NAMA_WIL: string;
  TOTAL_REKAM: number;
  TOTAL_CETAK: number;
  TOTAL_IKD: number;
  TOTAL_AKTE_17: number;
  TOTAL_KIA: number;
  TOTAL_JUMLAH: number;
};

export type TTotals = {
  TOTAL_REKAM: number;
  TOTAL_CETAK: number;
  TOTAL_IKD: number;
  TOTAL_AKTE_17: number;
  TOTAL_KIA: number;
  TOTAL_JUMLAH: number;
};

export function useGeulisData() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TWilayahData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/dashboard/geulis", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        if (json?.success && Array.isArray(json?.data)) {
          setData(
            json.data.map((r: any) => ({
              NO_WIL: Number(r.NO_WIL) || 0,
              NAMA_WIL: String(r.NAMA_WIL ?? ""),
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
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Gagal memuat data");
          setData([]);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  // 🔢 Hitung total semua kolom (memoized)
  const totals: TTotals = useMemo(() => {
    return data.reduce<TTotals>(
      (acc, r) => ({
        TOTAL_REKAM: acc.TOTAL_REKAM + (r.TOTAL_REKAM ?? 0),
        TOTAL_CETAK: acc.TOTAL_CETAK + (r.TOTAL_CETAK ?? 0),
        TOTAL_IKD: acc.TOTAL_IKD + (r.TOTAL_IKD ?? 0),
        TOTAL_AKTE_17: acc.TOTAL_AKTE_17 + (r.TOTAL_AKTE_17 ?? 0),
        TOTAL_KIA: acc.TOTAL_KIA + (r.TOTAL_KIA ?? 0),
        TOTAL_JUMLAH: acc.TOTAL_JUMLAH + (r.TOTAL_JUMLAH ?? 0),
      }),
      {
        TOTAL_REKAM: 0,
        TOTAL_CETAK: 0,
        TOTAL_IKD: 0,
        TOTAL_AKTE_17: 0,
        TOTAL_KIA: 0,
        TOTAL_JUMLAH: 0,
      }
    );
  }, [data]);

  // 🧾 Row siap pakai untuk <tfoot>
  const totalRow: TWilayahData = useMemo(
    () => ({
      NO_WIL: 0,
      NAMA_WIL: "Total",
      ...totals,
    }),
    [totals]
  );

  return { data, loading, error, totals, totalRow };
}
