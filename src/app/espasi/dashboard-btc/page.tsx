"use client";

import EspasiDashboardScreen from "@/components/espasi/EspasiDashboardScreen";

const LOKETS = [
  { label: "A", image: "/assets/img/loket-akta-kelahiran.png" },
  { label: "B", image: "/assets/img/loket-perekaman.png" },
  { label: "C", image: "/assets/img/loket-kia.png" },
];

export default function EspasiDashboardBtcPage() {
  return <EspasiDashboardScreen eventName="panggil_btc" lokets={LOKETS} speakLetterPrefix />;
}
