"use client";

import { useDashboardData } from "@/hooks/useDashboardData";

export default function KtpElStats() {
  const { data, loading } = useDashboardData();

  const stats = [
    { label: "Perekaman KTP-EL",   value: data.perekaman },
    { label: "Pencetakan KTP-EL",  value: data.pencetakan },
    { label: "Pengeluaran Blangko", value: data.blangko_out },
    { label: "Sisa Blangko E-KTP", value: data.sisa_blangko },
    { label: "Print Ready Record", value: data.prr },
    { label: "Sent For Enrollment", value: data.sfe },
    { label: "Duplicate Record",   value: data.duplicate },
    { label: "Tunggakan Suket",    value: data.suket },
  ];

  return (
    <section className="relative bg-[#0a0f14]/80 p-6 rounded-2xl border border-cyan-400/20 shadow-[0_0_25px_rgba(0,255,255,0.15)] backdrop-blur-xl overflow-hidden group">
      {/* Grid & Sweep background */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[length:42px_42px] animate-[movegrid_24s_linear_infinite] opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,255,255,0.12)_50%,transparent_60%)] animate-[sweep_6s_linear_infinite]" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-400/10 shadow-[inset_0_0_20px_rgba(0,255,255,0.15)] pointer-events-none" />

      <h2 className="relative text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 animate-cyanchange mb-6 text-center drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
        Dashboard KTP-EL
      </h2>

      {loading ? (
        <p className="text-center text-cyan-300/70">Memuat data…</p>
      ) : (
        <>
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 z-10">
            {stats.map((item, idx) => (
              <div
                key={idx}
                className="relative bg-[#0d151b]/80 border border-cyan-400/20 rounded-xl p-4 text-center transition-all duration-500 hover:scale-[1.04] hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(0,255,255,0.25)] group"
              >
                <p className="relative text-3xl font-extrabold text-cyan-300 drop-shadow-[0_0_8px_rgba(0,255,255,0.4)] group-hover:text-cyan-200 transition-all">
                  {item.value.toLocaleString("id-ID")}
                </p>
                <p className="text-gray-400 text-xs mt-2 tracking-wide">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {/* ====== Bagian Informasi Waktu (sesuai jQuery lama) ====== */}
          <div className="relative mt-5 flex flex-col items-end gap-1">
            <h5 className="text-cyan-300/90 text-sm font-medium">
              Tanggal{" "}
              <span id="date-part" className="text-cyan-200">{data.time.date}</span>{" "}
              <span id="time-part" className="text-cyan-200">{data.time.time}</span>
            </h5>

            {/* Jika offline (dashboard_between == 0) tampilkan banner merah */}
            {data.time.between === 0 ? (
              <h5
                id="is_services"
                className="m-0 text-red-400 text-sm font-semibold inline-flex items-center gap-2"
                style={{ display: "block" }}
                aria-live="polite"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-ping" />
                Service Dashboard Is Offline{" "}
                <span id="date-diff" className="ml-1">
                  {data.time.minutesAgo} Minutes Ago
                </span>
                , Please Check The Service !
              </h5>
            ) : (
              <h5 id="is_services" className="hidden" />
            )}
          </div>
        </>
      )}
    </section>
  );
}
