"use client";

import { useCallback, useEffect, useState } from "react";

export type TMasterRequestRow = {
  user_id: string;
  nama_lgkp: string;
  nama_kantor: string;
  nik: string;
  pengajuan_b: number;
  pengajuan_n: number;
  pengajuan_y: number;
};

type TMasterRequestResponse = {
  success: boolean;
  data: TMasterRequestRow[];
  message?: string;
};

export function useMasterRequest() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TMasterRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/master/request", {
          cache: "no-store",
          signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const payload: TMasterRequestResponse = await res.json();

        if (payload.success && Array.isArray(payload.data)) {
          setRows(payload.data);
        } else {
          throw new Error(payload.message || "Data master pengajuan tidak valid");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("? Gagal memuat master pengajuan:", err);
        setError(err?.message || "Gagal memuat master pengajuan");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => {
    load();
  }, [load]);

  return { loading, error, rows, reload };
}
