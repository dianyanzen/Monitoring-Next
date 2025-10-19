"use client";

import { useCallback, useEffect, useState } from "react";

export type TMasterContactRow = {
  nik: string;
  nama_lgkp: string;
  nama_kantor: string;
  tgl_lhr: string | null;
  tmpt_lhr: string | null;
  telp: string | null;
  alamat_rumah: string | null;
};

type TMasterContactResponse = {
  success: boolean;
  data: TMasterContactRow[];
  message?: string;
};

export function useMasterContact() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TMasterContactRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/master/contact", {
          cache: "no-store",
          signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const payload: TMasterContactResponse = await res.json();

        if (payload.success && Array.isArray(payload.data)) {
          setRows(payload.data);
        } else {
          throw new Error(payload.message || "Data master contact tidak valid");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("? Gagal memuat master contact:", err);
        setError(err?.message || "Gagal memuat master contact");
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
