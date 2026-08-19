import EspasiLoketCallLayout from "@/components/espasi/EspasiLoketCallLayout";

export default function DinasTerlewatLanjutanPage() {
  return (
    <EspasiLoketCallLayout
      title="Antrian Input Terlewat"
      endpoint="antrian-loket-menunggu"
      defaultLokasi="DISDUK"
      emptyText="Tidak ada antrian input terlewat"
      completeStatus="SELESAI"
      cancelStatus="SELESAI"
      cancelLabel="Batalkan"
    />
  );
}
