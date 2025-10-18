"use client";

import { useCapaian } from "@/hooks/dashboard/useCapaian";

export default function DataCapaian() {
  const { loading, rows } = useCapaian();

  return (
    <section className="relative bg-[#0a0f14]/80 p-6 rounded-2xl border border-cyan-400/20 shadow-[0_0_25px_rgba(0,255,255,0.15)] backdrop-blur-xl overflow-hidden group">
      {/* Background grid & sweep agar konsisten */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[length:42px_42px] animate-[movegrid_24s_linear_infinite] opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,255,255,0.12)_50%,transparent_60%)] animate-[sweep_6s_linear_infinite]" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-400/10 shadow-[inset_0_0_20px_rgba(0,255,255,0.15)] pointer-events-none" />

     
      <h2 className="relative text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 animate-cyanchange mb-6 text-center drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
        Dashboard Data Capaian
      </h2>

      {loading ? (
        <p className="text-center text-cyan-300/70">Memuat capaian…</p>
      ) : (
        <div className="relative grid grid-cols-1 gap-4 z-10">
          {rows.map((item) => (
            <div
              key={item.key}
              className="relative bg-[#0d151b]/80 border border-cyan-400/20 rounded-xl p-4 transition-all duration-400 hover:border-cyan-400/50 hover:shadow-[0_0_18px_rgba(0,255,255,0.2)]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">{item.title}</h3>
                <span className="text-xs text-cyan-300/90">
                  Progress: <b className="text-cyan-300">{item.progress.toFixed(2)}%</b>
                </span>
              </div>

              {/* Progress Bar cyan */}
              <div className="h-2.5 w-full rounded-full bg-[#0a1116] border border-cyan-400/20 overflow-hidden">
                <div
                  className="h-full bg-[linear-gradient(90deg,rgba(0,255,255,0.9),rgba(0,255,255,0.6))] animate-[glowline_3.5s_linear_infinite]"
                  style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-300">
                <div className="bg-[#0f1720]/60 border border-cyan-400/10 rounded-md p-2">
                  <span className="text-cyan-300/90">Realisasi</span>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">{item.realisasi}</span>
                    <span className="text-cyan-300">{item.persenR}</span>
                  </div>
                </div>
                <div className="bg-[#0f1720]/60 border border-cyan-400/10 rounded-md p-2">
                  <span className="text-cyan-300/90">Target</span>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">{item.target}</span>
                    <span className="text-cyan-300">{item.persenT}</span>
                  </div>
                </div>
              </div>

              {/* shimmer garis tipis */}
              <div className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
