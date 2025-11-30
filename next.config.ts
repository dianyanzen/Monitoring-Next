import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/InputKehilangan", destination: "/inputkehilangan" },
      { source: "/Pengajuan_ld", destination: "/pengajuan_ld" },
    ];
  },
};

export default nextConfig;
