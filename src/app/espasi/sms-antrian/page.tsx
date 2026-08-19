"use client";

import { useEffect, useMemo, useState } from "react";

type AntrianRow = {
  NIK?: string;
  NAMA?: string;
  KODE_PELAYANAN?: string;
  URUTAN?: string;
  STATUS_PELAYANAN?: string;
  TGL_PELAYANAN?: string;
  HARI?: string;
  TELEPON?: string;
  LOKASI?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type AntrianApiData = {
  mode?: string;
  rows?: AntrianRow[];
};

function toText(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function SmsAntrianPage() {
  const [rows, setRows] = useState<AntrianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fNik, setFNik] = useState("");
  const [fNama, setFNama] = useState("");
  const [fTelepon, setFTelepon] = useState("");
  const [fKode, setFKode] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fLokasi, setFLokasi] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ mode: "aktif", limit: "500" });
      const res = await fetch(`/api/espasi/antrian?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiEnvelope<AntrianApiData> | null;

      if (!json?.success) {
        setRows([]);
        setError(json?.message || "Gagal memuat data antrian");
        return;
      }

      setRows(Array.isArray(json.data?.rows) ? json.data?.rows : []);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Gagal memuat data antrian");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRows = useMemo(() => {
    const nik = fNik.trim().toUpperCase();
    const nama = fNama.trim().toUpperCase();
    const telepon = fTelepon.trim().toUpperCase();
    const kode = fKode.trim().toUpperCase();
    const status = fStatus.trim().toUpperCase();
    const lokasi = fLokasi.trim().toUpperCase();

    return rows.filter((row) => {
      const mNik = !nik || toText(row.NIK).toUpperCase().includes(nik);
      const mNama = !nama || toText(row.NAMA).toUpperCase().includes(nama);
      const mTel = !telepon || toText(row.TELEPON).toUpperCase().includes(telepon);
      const mKode = !kode || toText(row.KODE_PELAYANAN).toUpperCase().includes(kode);
      const mStatus = !status || toText(row.STATUS_PELAYANAN).toUpperCase().includes(status);
      const mLokasi = !lokasi || toText(row.LOKASI).toUpperCase().includes(lokasi);
      return mNik && mNama && mTel && mKode && mStatus && mLokasi;
    });
  }, [rows, fNik, fNama, fTelepon, fKode, fStatus, fLokasi]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2f7ff_0%,#ffffff_100%)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="rounded-2xl border border-[#dbe7ff] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-[#0f2f63]">SMS Antrian</h1>
              <p className="text-sm text-[#40639e]">Migrasi dari admin-panel-espasi Vue ke Next.js + API internal Espasi.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-xl border border-[#2f80ed] bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {loading ? "Memuat..." : "Refresh"}
            </button>
          </div>
        </header>

        <section className="rounded-2xl border border-[#dbe7ff] bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input value={fNik} onChange={(e) => setFNik(e.target.value)} placeholder="Filter NIK" className="h-10 rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]" />
            <input value={fNama} onChange={(e) => setFNama(e.target.value)} placeholder="Filter Nama" className="h-10 rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]" />
            <input value={fTelepon} onChange={(e) => setFTelepon(e.target.value)} placeholder="Filter Telepon" className="h-10 rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]" />
            <input value={fKode} onChange={(e) => setFKode(e.target.value)} placeholder="Filter Kode Pelayanan" className="h-10 rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]" />
            <input value={fStatus} onChange={(e) => setFStatus(e.target.value)} placeholder="Filter Status" className="h-10 rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]" />
            <input value={fLokasi} onChange={(e) => setFLokasi(e.target.value)} placeholder="Filter Lokasi" className="h-10 rounded-lg border border-[#c9d8f5] px-3 text-sm outline-none focus:border-[#2f80ed]" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#e3ecff]">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-[#edf4ff] text-[#123c76]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">NIK</th>
                  <th className="px-3 py-2 text-left font-semibold">NAMA</th>
                  <th className="px-3 py-2 text-left font-semibold">KODE PELAYANAN</th>
                  <th className="px-3 py-2 text-left font-semibold">URUTAN</th>
                  <th className="px-3 py-2 text-left font-semibold">STATUS</th>
                  <th className="px-3 py-2 text-left font-semibold">TGL PELAYANAN</th>
                  <th className="px-3 py-2 text-left font-semibold">HARI</th>
                  <th className="px-3 py-2 text-left font-semibold">TELEPON</th>
                  <th className="px-3 py-2 text-left font-semibold">LOKASI</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[#5d7fb8]">Memuat data...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-red-600">{error}</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-[#5d7fb8]">Data tidak ditemukan</td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={`${toText(row.NIK)}-${toText(row.URUTAN)}-${idx}`} className="border-t border-[#eef3ff]">
                      <td className="px-3 py-2">{idx + 1}</td>
                      <td className="px-3 py-2">{toText(row.NIK) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.NAMA) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.KODE_PELAYANAN) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.URUTAN) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.STATUS_PELAYANAN) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.TGL_PELAYANAN) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.HARI) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.TELEPON) || "-"}</td>
                      <td className="px-3 py-2">{toText(row.LOKASI) || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm text-[#40639e]">Total: {filteredRows.length.toLocaleString("id-ID")} baris</div>
        </section>
      </div>
    </div>
  );
}
