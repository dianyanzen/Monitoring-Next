"use client";

import EspasiDashboardScreen from "@/components/espasi/EspasiDashboardScreen";

const LOKETS = [
  { label: "A", image: "/assets/img/loket-akta-kelahiran.png" },
  { label: "B", image: "/assets/img/loket-perekaman.png" },
];

export default function EspasiDashboardDprdPage() {
  return <EspasiDashboardScreen eventName="panggil_dprd" lokets={LOKETS} speakLetterPrefix />;
}
