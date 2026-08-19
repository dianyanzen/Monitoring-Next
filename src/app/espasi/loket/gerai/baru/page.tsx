import EspasiLoketCallLayout from "@/components/espasi/EspasiLoketCallLayout";

export default function GeraiBaruPage() {
  return (
    <EspasiLoketCallLayout
      title="Antrian Gerai Baru"
      endpoint="antrian-loket"
      defaultLokasi="KIWARI"
      defaultLoket="A"
      showDownload
      emptyText="Tidak ada antrian gerai baru"
      completeStatus="SUDAH"
      cancelStatus="PENDING"
      cancelLabel="Lewat"
    />
  );
}
