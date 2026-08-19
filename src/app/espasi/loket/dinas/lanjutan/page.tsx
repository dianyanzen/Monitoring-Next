import EspasiLoketCallLayout from "@/components/espasi/EspasiLoketCallLayout";

export default function DinasLanjutanPage() {
  return (
    <EspasiLoketCallLayout
      title="Antrian Input Baru"
      endpoint="antrian-loket-sudah"
      defaultLokasi="DISDUK"
      showDownload
      emptyText="Tidak ada antrian input baru"
      completeStatus="SELESAI"
      cancelStatus="MENUNGGU"
      cancelLabel="Lewat"
    />
  );
}
