import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pastikan aset PDF eksternal (jika dipakai) ikut dibawa di output tracing.
  outputFileTracingIncludes: {
    "/api/report/getdaily/pdf2": ["./node_modules/@foliojs-fork/fontkit/data/**/*"],
    "/api/siak/repair_local_biometric/scan": ["./scripts/wsq_to_png.py"],
  },
  async rewrites() {
    return [
      { source: "/InputKehilangan", destination: "/inputkehilangan" },
      { source: "/Pengajuan_ld", destination: "/pengajuan_ld" },
      // Legacy Laravel paths (case-sensitive) -> Next.js routes
      { source: "/Report/Rekap", destination: "/report/Rekap" },
      { source: "/Report/RekapDaily", destination: "/report/RekapDaily" },
      { source: "/Report/Absensi_v", destination: "/report/absensi_v" },
      { source: "/Report/Absensi_vr", destination: "/report/absensi_vr" },
      { source: "/Report/GetDaily", destination: "/report/GetDaily" },
      { source: "/Report/GetDaily/Pdf2", destination: "/api/report/getdaily/pdf2" },
      { source: "/Barang/MasterBarang", destination: "/barang/masterbarang" },
      { source: "/Barang/MasterBarang/Edit/:id*", destination: "/barang/masterbarang" },
      { source: "/Barang/MasterBarang_in/Edit/:id*", destination: "/barang/inputmasuk" },
      { source: "/Barang/MasterBarang_out/Edit/:id*", destination: "/barang/inputkeluar" },
      { source: "/Barang/InputMasuk", destination: "/barang/inputmasuk" },
      { source: "/Barang/InputKeluar", destination: "/barang/inputkeluar" },
      { source: "/Barang/CekBarang", destination: "/barang/cekbarang" },
      { source: "/Barang/Laporan", destination: "/barang/laporan" },
      { source: "/Barang/MasterAset", destination: "/barang/masteraset" },
      { source: "/Barang/InputAset", destination: "/barang/inputaset" },
      { source: "/Barang/CekAset", destination: "/barang/cekaset" },
      { source: "/Barang/LaporanAset", destination: "/barang/laporanaset" },
    ];
  },
};

export default nextConfig;
