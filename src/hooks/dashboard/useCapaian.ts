// FILE: src/hooks/dashboard/useCapaian.ts
"use client";

import { useEffect, useState } from "react";

type TCapaianAPI = {
  success: boolean;
  data?: {
    TARGET_REKAM_R: string; TARGET_REKAM_P: string;
    TARGET_KIA_R: string;   TARGET_KIA_P: string;
    TARGET_AKTE_LHR_R: string; TARGET_AKTE_LHR_P: string;
    TARGET_IKD_R: string;      TARGET_IKD_P: string;

    CAPAIAN_REKAM_R: string; CAPAIAN_REKAM_P: string;
    CAPAIAN_KIA_R: string;   CAPAIAN_KIA_P: string;
    CAPAIAN_AKTE_LHR_R: string; CAPAIAN_AKTE_LHR_P: string;
    CAPAIAN_IKD_R: string;      CAPAIAN_IKD_P: string;
  };
};

const toNum = (s?: string) =>
  Number(String(s ?? "0").replace(/\./g, "").replace(",", ".")) || 0;

export function useCapaian() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    {
      key: string;
      title: string;
      realisasi: string;
      persenR: string;
      target: string;
      persenT: string;
      progress: number;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/dashboard/capaian", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json: TCapaianAPI = await res.json();
        if (!json?.success || !json.data) throw new Error("Data kosong");

        const d = json.data;
        const calc = (realisasiStr: string, targetStr: string) => {
          const real = toNum(realisasiStr);
          const targ = toNum(targetStr);
          if (targ <= 0) return 0;
          const pct = Math.max(0, Math.min(100, (real / targ) * 100));
          return Math.round(pct * 100) / 100;
        };

        const next = [
          {
            key: "rekam",
            title: "Perekaman KTP-EL",
            realisasi: d.CAPAIAN_REKAM_R,
            persenR: d.CAPAIAN_REKAM_P,
            target: d.TARGET_REKAM_R,
            persenT: d.TARGET_REKAM_P,
            progress: calc(d.CAPAIAN_REKAM_R, d.TARGET_REKAM_R),
          },
          {
            key: "kia",
            title: "Kartu Identitas Anak (KIA)",
            realisasi: d.CAPAIAN_KIA_R,
            persenR: d.CAPAIAN_KIA_P,
            target: d.TARGET_KIA_R,
            persenT: d.TARGET_KIA_P,
            progress: calc(d.CAPAIAN_KIA_R, d.TARGET_KIA_R),
          },
          {
            key: "akta",
            title: "Akta Kelahiran 0–17 Tahun",
            realisasi: d.CAPAIAN_AKTE_LHR_R,
            persenR: d.CAPAIAN_AKTE_LHR_P,
            target: d.TARGET_AKTE_LHR_R,
            persenT: d.TARGET_AKTE_LHR_P,
            progress: calc(d.CAPAIAN_AKTE_LHR_R, d.TARGET_AKTE_LHR_R),
          },
          {
            key: "ikd",
            title: "Identitas Kependudukan Digital (IKD)",
            realisasi: d.CAPAIAN_IKD_R,
            persenR: d.CAPAIAN_IKD_P,
            target: d.TARGET_IKD_R,
            persenT: d.TARGET_IKD_P,
            progress: calc(d.CAPAIAN_IKD_R, d.TARGET_IKD_R),
          },
        ];

        setRows(next);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("load capaian error:", err);
          setError(err.message || "Gagal memuat data capaian");
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return { loading, rows, error };
}
