import EspasiLoketCallLayout from "@/components/espasi/EspasiLoketCallLayout";

export default function DinasTerlewatPage() {
  return (
    <EspasiLoketCallLayout
      title="Antrian Verifikasi Terlewat"
      endpoint="antrian-loket-terlewat"
      defaultLokasi="DISDUK"
      showLayanan={false}
      emptyText="Tidak ada antrian verifikasi terlewat"
      completeStatus="SUDAH"
      cancelStatus="SUDAH"
      cancelLabel="Batalkan"
    />
  );
}
