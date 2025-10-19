"use client";

import { useEffect, useState } from "react";

type TItem = {
  name: string;
  today: { baru: number; upload: number; tidakLengkap: number };
  total: { baru: number; upload: number; tidakLengkap: number };
  verif: number;
  publish: number;
};

function useSalaman() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TItem[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/dashboard/salaman", { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;
        if (json?.success && Array.isArray(json?.data)) setData(json.data);
        else setData([]);
      } catch {
        if (alive) setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  return { loading, data };
}

export default function PelayananOnline() {
  const { loading, data } = useSalaman();

  return (
    <section className="relative bg-[#0a0f14]/80 p-6 rounded-2xl border border-cyan-400/20 shadow-[0_0_25px_rgba(0,255,255,0.15)] backdrop-blur-xl overflow-hidden group mt-8">
      {/* cyberpunk grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,255,255,0.04)_1px,transparent_1px),linear-gradient(rgba(0,255,255,0.04)_1px,transparent_1px)] bg-[length:42px_42px] animate-[movegrid_24s_linear_infinite] opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,255,255,0.12)_50%,transparent_60%)] animate-[sweep_6s_linear_infinite]" />
      <div className="absolute inset-0 rounded-2xl border border-cyan-400/10 shadow-[inset_0_0_20px_rgba(0,255,255,0.15)] pointer-events-none" />

      <div className="relative z-10">
        {/* Judul utama */}
        <h2 className="relative text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-200 animate-cyanchange mb-6 text-center drop-shadow-[0_0_8px_rgba(0,255,255,0.5)]">
          Dashboard Pelayanan Online
        </h2>
        <p className="text-center text-sm text-cyan-200/80 mb-8">
          Status pengajuan dan progres pelayanan daring Disdukcapil Kota Bandung
        </p>

        {loading ? (
          <p className="text-center text-cyan-300/70 animate-pulse">
            Memuat data pelayanan...
          </p>
        ) : data.length === 0 ? (
          <p className="text-center text-cyan-300/70 italic">
            Tidak ada data yang tersedia saat ini.
          </p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.map((item, i) => (
                <div
                  key={i}
                  className="relative bg-[#0d151b]/80 rounded-xl border border-cyan-400/20 p-5 hover:shadow-[0_0_25px_rgba(0,255,255,0.25)] transition-all"
                >
                  {/* Nama layanan */}
                  <h3 className="text-lg font-semibold text-center text-white mb-4 drop-shadow-[0_0_6px_rgba(0,255,255,0.3)]">
                    {item.name}
                  </h3>

                  {/* Hari Ini */}
                  <div className="mb-4">
                    <p className="text-cyan-400 font-bold text-center mb-2">
                      Hari Ini
                    </p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between font-bold text-cyan-100/90">
                        <span>Baru</span>
                        <span className="font-bold text-white">
                          {item.today.baru.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-cyan-100/90">
                        <span>Upload Ulang</span>
                        <span className="font-bold text-white">
                          {item.today.upload.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-cyan-100/90">
                        <span>Tidak Lengkap</span>
                        <span className="font-bold text-white">
                          {item.today.tidakLengkap.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Keseluruhan */}
                  <div className="mb-4">
                    <p className="text-cyan-400 font-bold text-center mb-2">
                      Keseluruhan
                    </p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between font-bold text-cyan-100/90">
                        <span>Baru</span>
                        <span className="font-bold text-white">
                          {item.total.baru.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-cyan-100/90">
                        <span>Upload Ulang</span>
                        <span className="font-bold text-white">
                          {item.total.upload.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-cyan-100/90">
                        <span>Tidak Lengkap</span>
                        <span className="font-bold text-white">
                          {item.total.tidakLengkap.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Verifikasi & Publish */}
                  <div className="flex justify-between border-t border-cyan-400/10 pt-3 text-sm">
                    <div className="text-left">
                      <p className="text-cyan-400 font-bold leading-tight">
                        Terverifikasi
                      </p>
                      <p className="text-white font-bold">
                        {item.verif.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 font-bold leading-tight">
                        Terpublikasi
                      </p>
                      <p className="text-white font-bold">
                        {item.publish.toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-cyan-300/60 mt-8 italic">
              Sumber data: Pelayanan Salaman — Disdukcapil Kota Bandung diperbarui real-time
            </p>
          </>
        )}
      </div>
    </section>
  );
}
