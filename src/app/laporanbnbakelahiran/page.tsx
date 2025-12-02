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
  { data: (row: any) => row.nik ?? "-", title: "NIK Bayi", width: "140px" },
  { data: (row: any) => row.nama ?? "-", title: "Nama Bayi", width: "200px" },
  { data: (row: any) => row.noAkta ?? "-", title: "No Akta", width: "140px" },
  { data: (row: any) => row.tglLahir ?? "-", title: "Tanggal Lahir", width: "140px" },
  { data: (row: any) => row.tglAkta ?? "-", title: "Tanggal Akta", width: "140px" },
  { data: (row: any) => row.namaKel ?? "-", title: "Kelurahan", width: "160px" },
  { data: (row: any) => row.namaKec ?? "-", title: "Kecamatan", width: "160px" },
  { data: (row: any) => row.namaIbu ?? "-", title: "Nama Ibu", width: "180px" },
  { data: (row: any) => row.namaAyah ?? "-", title: "Nama Ayah", width: "180px" },
  { data: (row: any) => row.alamat ?? "-", title: "Alamat Orang Tua", width: "220px" },
  { data: (row: any) => row.rt ?? "-", title: "RT", className: "dt-body-center", width: "70px" },
  { data: (row: any) => row.rw ?? "-", title: "RW", className: "dt-body-center", width: "70px" },
  { data: (row: any) => row.anakKe ?? "-", title: "Anak Ke", className: "dt-body-center", width: "80px" },
  { data: (row: any) => row.berat ?? "-", title: "Berat (kg)", className: "dt-body-right", width: "100px" },
  { data: (row: any) => row.panjang ?? "-", title: "Panjang (cm)", className: "dt-body-right", width: "110px" },
];

export default function LaporanBnbaKelahiranPage() {
  return (
    <WilayahReportPage
      endpoint="/api/laporan/bnba/kelahiran"
      tableId="dt-laporan-bnba-kelahiran"
      tableKey="laporan-bnba-kelahiran"
      columns={columns}
      minWidth={1300}
      order={[[4, "desc"]]}
      badgeLabel="Modul BNBA"
      moduleLabel="Laporan BNBA Kelahiran"
      headerTitle="Laporan Akta Kelahiran"
      headerSubtitle="Laporan BNBA – Akta Kelahiran"
      description="Rekap penerbitan akta kelahiran berdasarkan BNBA dalam rentang tanggal tertentu."
      totalLabel="akta kelahiran"
      extraFilters={[
        { key: "nik", label: "NIK Bayi", placeholder: "Masukan NIK Bayi" },
        { key: "noAkta", label: "No Akta", placeholder: "Masukan No Akta" },
      ]}
    />
  );
}
