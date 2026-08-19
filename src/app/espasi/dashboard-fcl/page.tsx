"use client";

import EspasiDashboardScreen from "@/components/espasi/EspasiDashboardScreen";

const LOKETS = [
  { label: "A", image: "/assets/img/loket-akta-kelahiran.png" },
  { label: "B", image: "/assets/img/loket-akta-kematian.png" },
  { label: "C", image: "/assets/img/loket-perekaman.png" },
  { label: "D", image: "/assets/img/loket-kia.png" },
];

export default function EspasiDashboardFclPage() {
  return <EspasiDashboardScreen eventName="panggil_KIWARI" lokets={LOKETS} speakLetterPrefix />;
}
