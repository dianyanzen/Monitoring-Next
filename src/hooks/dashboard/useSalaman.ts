// FILE: src/hooks/dashboard/useSalaman.ts
"use client";

import { useEffect, useState } from "react";

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

export function useSalaman() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TSalamanRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/dashboard/salaman", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data: TSalamanResponse = await res.json();

        if (data.success && Array.isArray(data.data)) {
          setRows(data.data);
        } else {
          throw new Error(data.message || "Data Salaman tidak valid");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("❌ Gagal memuat data salaman:", err);
          setError(err.message || "Gagal memuat data Salaman");
          setRows([]);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return { loading, error, rows };
}
