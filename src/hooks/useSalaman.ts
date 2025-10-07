"use client";

import { useEffect, useState } from "react";

// Struktur data frontend Pelayanan Online
export type TSalamanRow = {
  name: string;
  today: {
    baru: number;
    upload: number;
    tidakLengkap: number;
  };
  total: {
    baru: number;
    upload: number;
    tidakLengkap: number;
  };
  verif: number;
  publish: number;
};

type TSalamanResponse = {
  success: boolean;
  data: TSalamanRow[];
  message?: string;
};

/**
 * Hook untuk mengambil data dari /api/dashboard/salaman
 * Sumber: VW_SIAK_SALAMAN (schema WEBDB)
 * Tujuan: Dashboard Pelayanan Online
 */
export function useSalaman() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TSalamanRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/dashboard/salaman", { cache: "no-store" });
        const data: TSalamanResponse = await res.json();

        if (!alive) return;

        if (data.success && Array.isArray(data.data)) {
          setRows(data.data);
        } else {
          console.warn("⚠️ Data salaman kosong atau format tidak sesuai");
          setRows([]);
        }
      } catch (err) {
        console.error("❌ Gagal memuat data salaman:", err);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  return { loading, rows };
}
