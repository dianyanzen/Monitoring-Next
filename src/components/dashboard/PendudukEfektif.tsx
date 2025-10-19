"use client";

import Image from "next/image";
import { usePopulation } from "@/hooks/dashboard/usePopulation";

export default function PendudukEfektif() {
  const { loading, population, periode } = usePopulation();

  return (
    <section className="relative bg-[#0a0f14]/80 p-6 rounded-2xl border border-cyan-400/20 shadow-[0_0_25px_rgba(0,255,255,0.15)] backdrop-blur-xl overflow-hidden group text-center">
      {/* Background grid & sweep */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[length:42px_42px] animate-[movegrid_24s_linear_infinite] opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,255,255,0.12)_50%,transparent_60%)] animate-[sweep_6s_linear_infinite]" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-400/10 shadow-[inset_0_0_20px_rgba(0,255,255,0.15)] pointer-events-none" />

      <div className="relative z-10">
        {/* Judul */}
        <div className="mb-4">
          <h2 className="relative text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 animate-cyanchange mb-6 text-center drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
            Dashboard Penduduk Efektif
          </h2>
          {!loading && (
            <p className="text-xs text-cyan-300/80 mt-1">{periode}</p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-cyan-300/70">Memuat data penduduk…</p>
        ) : (
          <>
            {/* Kartu angka utama */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                <i className="ti-user text-2xl text-cyan-300" />
                <h4 className="text-cyan-200/90 text-sm mt-2">Jumlah Penduduk</h4>
                <p className="text-2xl font-bold text-white mt-1">
                  {population.JUMLAH_PENDUDUK.toLocaleString("id-ID")}
                </p>
              </div>

              {/* Empat box kecil */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <i className="fa fa-child text-2xl text-cyan-300" />
                  <h4 className="text-cyan-200/90 text-sm mt-2">Kelahiran</h4>
                  <p className="text-xl font-semibold text-white mt-1">
                    {population.AKTA_KELAHIRAN.toLocaleString("id-ID")}
                  </p>
                  <p className="text-xs text-cyan-300/70">{periode}</p>
                </div>

                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <i className="fa fa-ambulance text-2xl text-cyan-300" />
                  <h4 className="text-cyan-200/90 text-sm mt-2">Kematian</h4>
                  <p className="text-xl font-semibold text-white mt-1">
                    {population.AKTA_KEMATIAN.toLocaleString("id-ID")}
                  </p>
                  <p className="text-xs text-cyan-300/70">{periode}</p>
                </div>

                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <i className="fa fa-sign-in text-2xl text-cyan-300" />
                  <h4 className="text-cyan-200/90 text-sm mt-2">Kedatangan</h4>
                  <p className="text-xl font-semibold text-white mt-1">
                    {population.KEDATANGAN.toLocaleString("id-ID")}
                  </p>
                  <p className="text-xs text-cyan-300/70">{periode}</p>
                </div>

                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <i className="fa fa-sign-out text-2xl text-cyan-300" />
                  <h4 className="text-cyan-200/90 text-sm mt-2">Perpindahan</h4>
                  <p className="text-xl font-semibold text-white mt-1">
                    {population.PERPINDAHAN.toLocaleString("id-ID")}
                  </p>
                  <p className="text-xs text-cyan-300/70">{periode}</p>
                </div>
              </div>
            </div>

            {/* Spotlight: Real-Time Population Estimate */}
            <div className="mt-6 relative overflow-hidden rounded-xl border border-cyan-400/20">
              {/* Background image */}
              <div className="absolute inset-0">
                <Image
                  src="/assets/plugins/images/wallpaper2.jpg"
                  alt="background"
                  fill
                  className="object-cover opacity-30"
                  priority
                />
                <div className="absolute inset-0 bg-[#1d2a38]/70" />
              </div>

              <div className="relative p-6 text-center text-white">
                <h2 className="relative text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 animate-cyanchange mb-6 text-center drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
                  Real-Time Population Estimate
                </h2>
                <p className="text-sm text-cyan-100/90 mt-1">
                  Dynamic Population Projection Based on Civil Registration Updates
                </p>

                <p className="mt-4 text-4xl md:text-5xl font-extrabold tracking-wider drop-shadow-[0_0_10px_rgba(0,255,255,0.35)] text-cyan-50">
                  {population.PENDUDUK_EFEKTIF.toLocaleString("id-ID")}
                </p>

                <p className="mt-2 text-xs">
                  Rumus:{" "}
                  <code className="bg-black/30 px-2 py-1 rounded border border-cyan-400/20">
                    Jumlah Penduduk Efektif = Jumlah Penduduk + (Kelahiran + Kedatangan) - (Kematian + Perpindahan)
                  </code>
                </p>

                <p className="mt-2 text-xs text-cyan-100/90">{periode}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
