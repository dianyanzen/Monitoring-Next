"use client";

import EspasiDashboardScreen from "@/components/espasi/EspasiDashboardScreen";

const LOKETS = [
  { label: "A", image: "/assets/img/loket-akta-kelahiran.png" },
  { label: "B", image: "/assets/img/loket-perekaman.png" },
  { label: "C", image: "/assets/img/loket-kia.png" },
  { label: "D", image: "/assets/img/loket-akta-kematian.png" },
];

export default function EspasiDashboardMimPage() {
  return <EspasiDashboardScreen eventName="panggil_mim" lokets={LOKETS} speakLetterPrefix />;
}
