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
  { data: (row: any) => row.nik ?? "-", title: "NIK", width: "140px" },
  { data: (row: any) => row.nama ?? "-", title: "Nama Penduduk", width: "200px" },
  { data: (row: any) => row.noAkta ?? "-", title: "No Akta", width: "140px" },
  { data: (row: any) => row.tglMati ?? "-", title: "Tanggal Meninggal", width: "150px" },
  { data: (row: any) => row.tglAkta ?? "-", title: "Tanggal Akta", width: "140px" },
  { data: (row: any) => row.namaKel ?? "-", title: "Kelurahan", width: "160px" },
  { data: (row: any) => row.namaKec ?? "-", title: "Kecamatan", width: "160px" },
  { data: (row: any) => row.alamat ?? "-", title: "Alamat", width: "220px" },
  { data: (row: any) => row.rt ?? "-", title: "RT", className: "dt-body-center", width: "70px" },
  { data: (row: any) => row.rw ?? "-", title: "RW", className: "dt-body-center", width: "70px" },
  { data: (row: any) => row.namaIbu ?? "-", title: "Nama Ibu", width: "180px" },
  { data: (row: any) => row.namaAyah ?? "-", title: "Nama Ayah", width: "180px" },
];

export default function LaporanBnbaKematianPage() {
  return (
    <WilayahReportPage
      endpoint="/api/laporan/bnba/kematian"
      tableId="dt-laporan-bnba-kematian"
      tableKey="laporan-bnba-kematian"
      columns={columns}
      minWidth={1200}
      order={[[4, "desc"]]}
      badgeLabel="Modul BNBA"
      moduleLabel="Laporan BNBA Kematian"
      headerTitle="Laporan Akta Kematian"
      headerSubtitle="Laporan BNBA – Akta Kematian"
      description="Rekap penerbitan akta kematian berdasarkan BNBA dalam rentang tanggal tertentu."
      totalLabel="akta kematian"
      extraFilters={[
        { key: "nik", label: "NIK Penduduk", placeholder: "Masukan NIK" },
        { key: "noAkta", label: "No Akta", placeholder: "Masukan No Akta" },
      ]}
    />
  );
}
