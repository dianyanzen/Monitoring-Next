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
    let alive = true;

    async function load() {
      try {
        const [pop, per] = await Promise.all([
          fetch("/api/dashboard/population").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/period").then(r => r.json()).catch(() => ({})),
        ]);

        if (!alive) return;
        if (pop?.success && pop?.data) setPopulation(pop.data as TPopulation);
        if (per?.success && typeof per?.periode === "string") setPeriode(per.periode);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  return { loading, population, periode };
}
