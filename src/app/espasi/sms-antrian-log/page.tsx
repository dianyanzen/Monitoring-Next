"use client";

import EspasiAntrianModeTable from "@/components/espasi/EspasiAntrianModeTable";

export default function SmsAntrianLogPage() {
  return (
    <EspasiAntrianModeTable
      mode="log"
      title="SMS Antrian Log"
      subtitle="Histori gabungan inbox dan outbox SMS antrian."
    />
  );
}
