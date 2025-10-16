// FILE: src/hooks/dashboard/usePopulation.ts
"use client";

import { useEffect, useState } from "react";

type TPopulation = {
  JUMLAH_PENDUDUK: number;
  AKTA_KELAHIRAN: number;
  AKTA_KEMATIAN: number;
  PERPINDAHAN: number;
  KEDATANGAN: number;
  PENDUDUK_EFEKTIF: number;
};

const ZERO: TPopulation = {
  JUMLAH_PENDUDUK: 0,
  AKTA_KELAHIRAN: 0,
  AKTA_KEMATIAN: 0,
  PERPINDAHAN: 0,
  KEDATANGAN: 0,
  PENDUDUK_EFEKTIF: 0,
};

const toNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function usePopulation() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<string>("");
  const [population, setPopulation] = useState<TPopulation>(ZERO);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // --- POPULATION
        const popRes = await fetch("/api/dashboard/population", {
          cache: "no-store",
          signal: controller.signal,
          credentials: "include",
        });
        if (!popRes.ok) throw new Error(`HTTP ${popRes.status}`);
        const popJson = await popRes.json();

        // Terima {success:true,data:{...}} atau objek langsung
        const raw = (popJson?.success ? popJson?.data : popJson) as any;
        if (!raw || typeof raw !== "object") throw new Error("Data populasi tidak valid");

        const next: TPopulation = {
          JUMLAH_PENDUDUK: toNum(raw.JUMLAH_PENDUDUK),
          AKTA_KELAHIRAN: toNum(raw.AKTA_KELAHIRAN),
          AKTA_KEMATIAN: toNum(raw.AKTA_KEMATIAN),
          PERPINDAHAN: toNum(raw.PERPINDAHAN),
          KEDATANGAN: toNum(raw.KEDATANGAN),
          PENDUDUK_EFEKTIF: toNum(raw.PENDUDUK_EFEKTIF),
        };
        setPopulation(next);

        // --- OPTIONAL: periode (abaikan jika 404)
        try {
          const perRes = await fetch("/api/dashboard/period", {
            cache: "no-store",
            signal: controller.signal,
            credentials: "include",
          });
          if (perRes.ok) {
            const pj = await perRes.json();
            setPeriode(String(pj?.periode ?? pj?.data?.periode ?? ""));
          }
        } catch {
          /* no-op */
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return; // dibatalkan, jangan set state
        console.error("load population error:", err);
        setError(err?.message || "Gagal memuat data populasi");
        setPopulation(ZERO); // fallback aman
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  return { loading, error, population, periode };
}
