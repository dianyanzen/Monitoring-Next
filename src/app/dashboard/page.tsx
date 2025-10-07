"use client";

import KtpElStats from "@/components/dashboard/KtpElStats";
import DataCapaian from "@/components/dashboard/DataCapaian";
import PendudukEfektif from "@/components/dashboard/PendudukEfektif";
import DkbStats from "@/components/dashboard/DkbStats";
import GeulisStats from "@/components/dashboard/GeulisStats";
import PelayananOnline from "@/components/dashboard/PelayananOnline";
import KecamatanStats from "@/components/dashboard/KecamatanStats";

export default function DashboardPage() {
  return (
    <div className="relative px-8 pb-8 pt-6 md:pt-8 text-gray-200 space-y-8 mt-5">
      {/* Ambient Background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/3 w-[800px] h-[800px] bg-cyan-500/20 blur-[160px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/3 w-[700px] h-[700px] bg-fuchsia-600/10 blur-[140px] rounded-full animate-pulse-slow" />
      </div>

      {/* Title */}
      <div className="space-y-1 mb-2">
        <h1 className="text-3xl font-semibold tracking-wide text-cyan-400">
          Dashboard Monitoring Kependudukan
        </h1>
        <p className="text-sm text-gray-400">
          Sistem monitoring futuristik Disdukcapil Kota Bandung
        </p>
      </div>

      {/* Section: KTP-EL */}
      <KtpElStats />

      {/* Section: Data Capaian */}
      <DataCapaian />

      {/* Section: Penduduk Efektif */}
      <PendudukEfektif />

      {/* Section: DKB */}
      <DkbStats />

      {/* Section: Pelayanan Online */}
      <PelayananOnline />

      {/* Section: Geulis */}
      <GeulisStats />

      {/* Section: Kecamatan */}
      <KecamatanStats />
    </div>
  );
}
