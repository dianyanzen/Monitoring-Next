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
  { data: (row: any) => row.noWil ?? "-", title: "No Wilayah", width: "120px" },
  { data: (row: any) => row.namaWil ?? "-", title: "Nama Wilayah", width: "220px" },
  { data: (row: any) => row.jmlLahir ?? 0, title: "Jumlah Lahir", className: "dt-body-right", width: "140px", render: (val: any) => Number(val ?? 0).toLocaleString("id-ID") },
  { data: (row: any) => row.jmlMati ?? 0, title: "Jumlah Meninggal", className: "dt-body-right", width: "160px", render: (val: any) => Number(val ?? 0).toLocaleString("id-ID") },
  { data: (row: any) => row.jmlPindah ?? 0, title: "Jumlah Pindah", className: "dt-body-right", width: "150px", render: (val: any) => Number(val ?? 0).toLocaleString("id-ID") },
  { data: (row: any) => row.jmlDatang ?? 0, title: "Jumlah Datang", className: "dt-body-right", width: "150px", render: (val: any) => Number(val ?? 0).toLocaleString("id-ID") },
];

export default function LaporanBnbaLampidPage() {
  return (
    <WilayahReportPage
      endpoint="/api/laporan/bnba/lampid"
      tableId="dt-laporan-bnba-lampid"
      tableKey="laporan-bnba-lampid"
      columns={columns}
      minWidth={1000}
      order={[[1, "asc"]]}
      badgeLabel="Modul BNBA"
      moduleLabel="Laporan BNBA Lampid"
      headerTitle="Laporan Lampid"
      headerSubtitle="Laporan BNBA – Lampid"
      description="Rekap jumlah lahir, mati, pindah, dan datang berdasarkan BNBA Lampid."
      totalLabel="peristiwa"
    />
  );
}
