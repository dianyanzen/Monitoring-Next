"use client";

import { useDkb } from "@/hooks/dashboard/useDkb";

export default function DkbStats() {
  const { loading, ref, rows, latest } = useDkb();

  return (
    <section className="relative bg-[#0a0f14]/80 p-6 rounded-2xl border border-cyan-400/20 shadow-[0_0_25px_rgba(0,255,255,0.15)] backdrop-blur-xl overflow-hidden group text-center">
      {/* background */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[length:42px_42px] animate-[movegrid_24s_linear_infinite] opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,255,255,0.12)_50%,transparent_60%)] animate-[sweep_6s_linear_infinite]" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-400/10 shadow-[inset_0_0_20px_rgba(0,255,255,0.15)] pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-4">
          <h2 className="relative text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 animate-cyanchange mb-6 text-center drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
            Dashboard DKB
          </h2>
          {!loading && (
            <p className="mt-1 text-xs text-cyan-300/80 text-center">
              DKB Ref: <b className="text-cyan-200">{ref ?? "-"}</b>
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-cyan-300/70">Memuat DKB…</p>
        ) : (
          <>
            {/* highlight terbaru */}
            {latest && (
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <p className="text-xs text-cyan-300/80">DKB Terbaru</p>
                  <p className="text-2xl font-bold text-white">{latest.DKB}</p>
                </div>
                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <p className="text-xs text-cyan-300/80">Laki-Laki</p>
                  <p className="text-2xl font-bold text-white">{Number(latest.R1).toLocaleString("id-ID")}</p>
                </div>
                <div className="bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-4">
                  <p className="text-xs text-cyan-300/80">Perempuan</p>
                  <p className="text-2xl font-bold text-white">{Number(latest.R2).toLocaleString("id-ID")}</p>
                </div>
              </div>
            )}

            {/* tabel ringkas */}
            <div className="overflow-x-auto rounded-xl border border-cyan-400/20">
              <table className="min-w-full text-sm text-center">
                <thead className="bg-[#0d151b] text-cyan-200 border-b border-cyan-400/20">
                  <tr>
                    <th className="p-3 text-center">DKB</th>
                    <th className="p-3 text-center">Laki-Laki</th>
                    <th className="p-3 text-center">Perempuan</th>
                    <th className="p-3 text-center">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.DKB}-${i}`} className="border-b border-cyan-400/10 hover:bg-white/5">
                      <td className="p-3 text-white font-semibold">{r.DKB}</td>
                      <td className="p-3 text-white font-semibold">{Number(r.R1).toLocaleString("id-ID")}</td>
                      <td className="p-3 text-white font-semibold">{Number(r.R2).toLocaleString("id-ID")}</td>
                      <td className="p-3 text-white font-semibold">{Number(r.JUMLAH).toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
