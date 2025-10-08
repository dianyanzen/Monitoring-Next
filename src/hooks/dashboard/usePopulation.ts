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


export function usePopulation() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<string>("");
  const [population, setPopulation] = useState<TPopulation>({
    JUMLAH_PENDUDUK: 0,
    AKTA_KELAHIRAN: 0,
    AKTA_KEMATIAN: 0,
    PERPINDAHAN: 0,
    KEDATANGAN: 0,
    PENDUDUK_EFEKTIF: 0,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [pop, per] = await Promise.all([
          fetch("/api/dashboard/population", {
            cache: "no-store",
            signal: controller.signal,
          }).then(r => r.json()).catch(() => ({})),

          fetch("/api/dashboard/period", {
            cache: "no-store",
            signal: controller.signal,
          }).then(r => r.json()).catch(() => ({})),
        ]);

        if (pop?.success && pop?.data)
          setPopulation(pop.data as TPopulation);
        else
          throw new Error("Data populasi tidak valid");

        if (per?.success && typeof per?.periode === "string")
          setPeriode(per.periode);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("load population error:", err);
          setError(err.message || "Gagal memuat data populasi");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return { loading, error, population, periode };
}
