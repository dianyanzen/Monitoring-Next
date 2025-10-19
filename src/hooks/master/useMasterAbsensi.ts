"use client";

import { useCallback, useEffect, useState } from "react";

export type TMasterAbsensiRow = {
  user_id: string;
  nama_lgkp: string;
  nama_kantor: string;
  nik: string;
  jam_masuk: string | null;
  jam_keluar: string | null;
};

type TMasterAbsensiResponse = {
  success: boolean;
  data: TMasterAbsensiRow[];
  message?: string;
};

export function useMasterAbsensi() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TMasterAbsensiRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/master/absensi", {
          cache: "no-store",
          signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const payload: TMasterAbsensiResponse = await res.json();

        if (payload.success && Array.isArray(payload.data)) {
          setRows(payload.data);
        } else {
          throw new Error(payload.message || "Data master absensi tidak valid");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("? Gagal memuat master absensi:", err);
        setError(err?.message || "Gagal memuat master absensi");
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
