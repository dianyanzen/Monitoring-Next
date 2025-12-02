"use client";

import WilayahReportPage, { ReportPageProps } from "@/components/reports/WilayahReportPage";

const columns: ReportPageProps["columns"] = [
  {
    data: null,
    title: "No",
    className: "dt-body-center",
    orderable: false,
    width: "60px",
    render: (_: any, __: any, ___: any, meta: any) => meta.row + 1,
  },
  { data: (row: any) => row.noKk ?? "-", title: "No KK", width: "130px" },
  { data: (row: any) => row.nik ?? "-", title: "NIK", width: "140px" },
  { data: (row: any) => row.namaPemohon ?? "-", title: "Nama Pemohon", width: "200px" },
  { data: (row: any) => row.alamat ?? "-", title: "Alamat Tujuan", width: "220px" },
  { data: (row: any) => row.kel ?? "-", title: "Kelurahan Tujuan", width: "160px" },
  { data: (row: any) => row.kec ?? "-", title: "Kecamatan Tujuan", width: "160px" },
  { data: (row: any) => row.daerahAsal ?? "-", title: "Daerah Asal", width: "200px" },
  { data: (row: any) => row.kecAsal ?? "-", title: "Kecamatan Asal", width: "160px" },
  { data: (row: any) => row.kelAsal ?? "-", title: "Kelurahan Asal", width: "160px" },
  { data: (row: any) => row.alamatAsal ?? "-", title: "Alamat Asal", width: "220px" },
  { data: (row: any) => row.tglDatang ?? "-", title: "Tanggal Datang", width: "140px" },
  { data: (row: any) => row.jam ?? "-", title: "Jam", width: "110px" },
  { data: (row: any) => row.noDatang ?? "-", title: "No Datang", width: "150px" },
  { data: (row: any) => row.klasifikasi ?? "-", title: "Klasifikasi", width: "200px" },
];

export default function LaporanKedatanganPage() {
  return (
    <WilayahReportPage
      endpoint="/api/laporan/kedatangan"
      tableId="dt-laporan-kedatangan"
      tableKey="laporan-kedatangan"
      columns={columns}
      minWidth={1300}
      order={[[11, "desc"]]}
      badgeLabel="Modul Kedatangan"
      moduleLabel="Laporan Kedatangan"
      headerTitle="Laporan Kedatangan Penduduk"
      headerSubtitle="Laporan SIAK – Pindah Datang"
      description="Rekap data kedatangan penduduk berdasarkan BNBA SIAK dalam rentang tanggal tertentu."
      totalLabel="kedatangan"
      showKlasifikasi
      extraFilters={[
        { key: "nik", label: "NIK Pemohon", placeholder: "Masukan NIK" },
        { key: "noDatang", label: "No Datang", placeholder: "Masukan No Datang" },
      ]}
    />
  );
}
