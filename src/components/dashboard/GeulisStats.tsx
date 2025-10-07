"use client";

import { useGeulisData } from "@/hooks/useGeulisData";

function formatTanggal(date: Date) {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function GeulisStats() {
  const { data, loading } = useGeulisData();
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 30);
  const periode = `Periode ${formatTanggal(start)} - ${formatTanggal(today)}`;

  return (
    <section className="relative bg-[#0a0f14]/80 p-6 rounded-2xl border border-cyan-400/20 shadow-[0_0_25px_rgba(0,255,255,0.15)] backdrop-blur-xl overflow-hidden mt-8">
      {/* Cyberpunk background */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[length:42px_42px] animate-[movegrid_24s_linear_infinite] opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,255,255,0.12)_50%,transparent_60%)] animate-[sweep_6s_linear_infinite]" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-400/10 shadow-[inset_0_0_20px_rgba(0,255,255,0.15)] pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <h2 className="text-center text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 drop-shadow-[0_0_8px_rgba(0,255,255,0.5)] mb-2">
          Rekapitulasi Pelayanan GEULIS
        </h2>
        <p className="text-center text-sm text-cyan-200/80 mb-8">{periode}</p>

        {loading ? (
          <p className="text-center text-cyan-300/70 animate-pulse">
            Memuat data Geulis...
          </p>
        ) : data.length === 0 ? (
          <p className="text-center text-cyan-300/70 italic">
            Tidak ada data Geulis saat ini.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-cyan-400/20">
              <table className="w-full text-sm text-cyan-100/90">
                <thead className="bg-[#101010]/70 text-cyan-400 border-b border-cyan-400/20">
                  <tr>
                    <th className="text-left py-2 px-3">Nama Geulis</th>
                    <th className="text-right py-2 px-3">Rekaman KTP-el</th>
                    <th className="text-right py-2 px-3">Pencetakan</th>
                    <th className="text-right py-2 px-3">Identitas Digital</th>
                    <th className="text-right py-2 px-3">Akta 0–17</th>
                    <th className="text-right py-2 px-3">KIA</th>
                    <th className="text-right py-2 px-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-cyan-400/10 hover:bg-[#111a1f]/70 transition-all"
                    >
                      <td className="py-2 px-3 font-semibold text-white">
                        {row.NAMA_WIL}
                      </td>
                      <td className="text-right px-3">
                        {row.TOTAL_REKAM.toLocaleString("id-ID")}
                      </td>
                      <td className="text-right px-3">
                        {row.TOTAL_CETAK.toLocaleString("id-ID")}
                      </td>
                      <td className="text-right px-3">
                        {row.TOTAL_IKD.toLocaleString("id-ID")}
                      </td>
                      <td className="text-right px-3">
                        {row.TOTAL_AKTE_17.toLocaleString("id-ID")}
                      </td>
                      <td className="text-right px-3">
                        {row.TOTAL_KIA.toLocaleString("id-ID")}
                      </td>
                      <td className="text-right font-bold text-white px-3">
                        {row.TOTAL_JUMLAH.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-center text-xs text-cyan-300/60 mt-8 italic">
              Sumber data: Pelayanan Geulis — Disdukcapil Kota Bandung diperbarui real-time
            </p>
          </>
        )}
      </div>
    </section>
  );
}
