// FILE: src/hooks/dashboard/useDashboardData.ts
"use client";

import { useEffect, useState } from "react";

type TNumbers = {
  perekaman: number;
  pencetakan: number;
  blangko_out: number;
  sisa_blangko: number;
  prr: number;         // Print Ready Record
  sfe: number;         // Sent For Enrollment
  duplicate: number;
  suket: number;       // Tunggakan Suket
};

type TTime = {
  date: string;        // "DD-MM-YYYY"
  time: string;        // "HH:MM:SS"
  between: 0 | 1;      // 0 = offline, 1 = online (<=10 menit)
  minutesAgo: number;  // selisih menit
};

type TDashboard = TNumbers & {
  time: TTime;
};

const toNum = (v: any) => Number(String(v ?? 0).replace(/\D/g, "")) || 0;

export function useDashboardData(refreshMs = 900000) { // ⏱ 15 menit = 900000 ms
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TDashboard>({
    perekaman: 0,
    pencetakan: 0,
    blangko_out: 0,
    sisa_blangko: 0,
    prr: 0,
    sfe: 0,
    duplicate: 0,
    suket: 0,
    time: {
      date: "00-00-0000",
      time: "00:00:00",
      between: 0,
      minutesAgo: 9999,
    },
  });

  useEffect(() => {
    let alive = true;

    async function loadOnce() {
      try {
        const [
          m1, m2, m3, m4, m5, m6, m7, m8, t
        ] = await Promise.all([
          fetch("/api/dashboard/m1").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m2").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m3").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m4").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m5").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m6").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m7").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/m8").then(r => r.json()).catch(() => ({})),
          fetch("/api/dashboard/time").then(r => r.json()).catch(() => ({})),
        ]);

        if (!alive) return;

        setData({
          perekaman:     toNum(m1.data?.perekaman_today ?? m1.perekaman_today),
          pencetakan:    toNum(m2.data?.pencetakan_today ?? m2.pencetakan_today),
          blangko_out:   toNum(m6.data?.blangko_out ?? m6.blangko_out),
          sisa_blangko:  toNum(m8.data?.sisa_blangko ?? m8.sisa_blangko),
          prr:           toNum(m3.data?.sisa_prr ?? m3.sisa_prr),
          sfe:           toNum(m4.data?.sisa_sfe ?? m4.sisa_sfe),
          duplicate:     toNum(m7.data?.duplicate ?? m7.duplicate),
          suket:         toNum(m5.data?.sisa_suket ?? m5.sisa_suket),
          time: {
            date: String(t.data?.dashboard_date ?? t.dashboard_date ?? "00-00-0000"),
            time: String(t.data?.dashboard_time ?? t.dashboard_time ?? "00:00:00"),
            between: Number(t.data?.dashboard_between ?? t.dashboard_between ?? 0) === 1 ? 1 : 0,
            minutesAgo: Number(t.data?.dashboard_minutes ?? t.dashboard_minutes ?? 9999),
          },
        });

      } finally {
        if (alive) setLoading(false);
      }
    }

    // pertama kali
    loadOnce();

    // auto-refresh tiap 15 menit
    const iv = setInterval(loadOnce, refreshMs);

    // refresh juga saat tab kembali aktif
    const onVis = () => { if (document.visibilityState === "visible") loadOnce(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshMs]);

  return { data, loading };
}
