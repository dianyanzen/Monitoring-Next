import EspasiLoketCallLayout from "@/components/espasi/EspasiLoketCallLayout";

export default function LoketPage() {
  return (
    <EspasiLoketCallLayout
      title="Antrian Verifikasi Baru"
      endpoint="antrian-loket"
      defaultLokasi="DISDUK"
      showLayanan={false}
      showDownload
      emptyText="Tidak ada antrian verifikasi baru"
      completeStatus="SUDAH"
      cancelStatus="PENDING"
      cancelLabel="Lewat"
    />
  );
}
