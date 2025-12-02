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
  { data: (row: any) => row.alamat ?? "-", title: "Alamat Asal", width: "220px" },
  { data: (row: any) => row.kel ?? "-", title: "Kelurahan Asal", width: "160px" },
  { data: (row: any) => row.kec ?? "-", title: "Kecamatan Asal", width: "160px" },
  { data: (row: any) => row.daerahTujuan ?? "-", title: "Daerah Tujuan", width: "200px" },
  { data: (row: any) => row.kecTujuan ?? "-", title: "Kecamatan Tujuan", width: "160px" },
  { data: (row: any) => row.kelTujuan ?? "-", title: "Kelurahan Tujuan", width: "160px" },
  { data: (row: any) => row.alamatTujuan ?? "-", title: "Alamat Tujuan", width: "220px" },
  { data: (row: any) => row.tglPindah ?? "-", title: "Tanggal Pindah", width: "140px" },
  { data: (row: any) => row.jam ?? "-", title: "Jam", width: "110px" },
  { data: (row: any) => row.noPindah ?? "-", title: "No Pindah", width: "150px" },
  { data: (row: any) => row.klasifikasi ?? "-", title: "Klasifikasi", width: "200px" },
];

export default function LaporanPerpindahanPage() {
  return (
    <WilayahReportPage
      endpoint="/api/laporan/perpindahan"
      tableId="dt-laporan-perpindahan"
      tableKey="laporan-perpindahan"
      columns={columns}
      minWidth={1300}
      order={[[11, "desc"]]}
      badgeLabel="Modul Perpindahan"
      moduleLabel="Laporan Perpindahan"
      headerTitle="Laporan Perpindahan Penduduk"
      headerSubtitle="Laporan SIAK – Pindah Keluar"
      description="Rekap data perpindahan penduduk berdasarkan BNBA SIAK dalam rentang tanggal tertentu."
      totalLabel="perpindahan"
      showKlasifikasi
      extraFilters={[
        { key: "nik", label: "NIK Pemohon", placeholder: "Masukan NIK" },
        { key: "noPindah", label: "No Pindah", placeholder: "Masukan No Pindah" },
      ]}
    />
  );
}
