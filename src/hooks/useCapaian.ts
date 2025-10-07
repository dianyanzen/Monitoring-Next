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

const toNum = (s?: string) => Number(String(s ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
const toPct = (s?: string) => Number(String(s ?? "0").replace("%", "").replace(",", ".")) || 0;

export function useCapaian() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([
    {
      key: "rekam",
      title: "Perekaman KTP-EL",
      realisasi: "0",
      persenR: "0.00%",
      target: "0",
      persenT: "0.00%",
      progress: 0,
    },
    {
      key: "kia",
      title: "Kartu Identitas Anak (KIA)",
      realisasi: "0",
      persenR: "0.00%",
      target: "0",
      persenT: "0.00%",
      progress: 0,
    },
    {
      key: "akta",
      title: "Akta Kelahiran 0–17 Tahun",
      realisasi: "0",
      persenR: "0.00%",
      target: "0",
      persenT: "0.00%",
      progress: 0,
    },
    {
      key: "ikd",
      title: "Identitas Kependudukan Digital (IKD)",
      realisasi: "0",
      persenR: "0.00%",
      target: "0",
      persenT: "0.00%",
      progress: 0,
    },
  ]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res: TCapaianAPI = await fetch("/api/dashboard/capaian", { cache: "no-store" }).then(r => r.json());
        if (!alive || !res?.success || !res.data) return;

        const d = res.data;
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
      } catch (e) {
        console.error("load capaian error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  return { loading, rows };
}
