import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pastikan aset PDF eksternal (jika dipakai) ikut dibawa di output tracing.
  outputFileTracingIncludes: {
    "/api/report/getdaily/pdf2": ["./node_modules/@foliojs-fork/fontkit/data/**/*"],
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
    ];
  },
};

export default nextConfig;
