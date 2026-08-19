"use client";

import EspasiAntrianModeTable from "@/components/espasi/EspasiAntrianModeTable";

export default function TeleponPage() {
  return (
    <EspasiAntrianModeTable
      mode="telepon"
      title="Status Pemblokiran Telepon"
      subtitle="Monitoring nomor telepon yang mencapai ambang blokir SMS."
    />
  );
}
