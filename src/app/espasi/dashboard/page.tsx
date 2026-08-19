"use client";

import EspasiDashboardScreen from "@/components/espasi/EspasiDashboardScreen";

const LOKETS = [
  { label: "A", image: "/assets/img/loket-akta-kelahiran.png" },
  { label: "B", image: "/assets/img/loket-perekaman.png" },
  { label: "C", image: "/assets/img/loket-kia.png" },
  { label: "D", image: "/assets/img/loket-akta-kematian.png" },
  { label: "E", image: "/assets/img/loket-legalisasi.png" },
  { label: "F", image: "/assets/img/loket-perbaikan-data.png" },
  { label: "G", image: "/assets/img/loket-pindah-keluar.png" },
  { label: "H", image: "/assets/img/loket-wna.png" },
];

export default function EspasiDashboardPage() {
  return <EspasiDashboardScreen eventName="panggil_disduk" lokets={LOKETS} />;
}
