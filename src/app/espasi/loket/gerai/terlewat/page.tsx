import EspasiLoketCallLayout from "@/components/espasi/EspasiLoketCallLayout";

export default function GeraiTerlewatPage() {
  return (
    <EspasiLoketCallLayout
      title="Antrian Gerai Terlewat"
      endpoint="antrian-loket-terlewat"
      defaultLokasi="KIWARI"
      defaultLoket="A"
      emptyText="Tidak ada antrian gerai terlewat"
      completeStatus="SUDAH"
      cancelStatus="SUDAH"
      cancelLabel="Batalkan"
    />
  );
}
