"use client";

import { SearchReqPage } from "../_components/SearchReqPage";

const columns = [
  { data: "NO_KEC", title: "No Kec", className: "dt-body-center", width: "90px" },
  {
    data: "NIK",
    title: "NIK",
    className: "dt-body-center",
    width: "170px",
    render: (val: any, type: any) => {
      const nik = String(val ?? "").trim();
      if (type === "display") return `<span style="color:rgba(255,63,173,.02)">,</span><span>${nik}</span>`;
      return nik;
    },
  },
  { data: "NAMA_LENGKAP", title: "Nama Lengkap", width: "220px" },
  { data: "CURRENT_STATUS_CODE", title: "Status E-KTP", className: "dt-body-center", width: "160px" },
  { data: "REQ_DATE", title: "Req Date", className: "dt-body-center", width: "140px" },
  { data: "REQ_BY", title: "Req By", className: "dt-body-center", width: "140px" },
  { data: "PRINTED_DATE", title: "Print Date", className: "dt-body-center", width: "140px" },
  { data: "PRINTED_BY", title: "Print By", className: "dt-body-center", width: "140px" },
  { data: "KETERANGAN_STATUS", title: "Keterangan Pengajuan", className: "dt-body-center", width: "190px" },
  { data: "ALAMAT", title: "Alamat", width: "240px" },
  { data: "RW", title: "Rw", className: "dt-body-center", width: "80px" },
  { data: "RT", title: "Rt", className: "dt-body-center", width: "80px" },
  { data: "KODE_POS", title: "Kode Pos", className: "dt-body-center", width: "100px" },
  { data: "STAT_KWN", title: "Status Kawin", className: "dt-body-center", width: "140px" },
  { data: "JENIS_PKRJN", title: "Jenis Pekerjaan", className: "dt-body-center", width: "160px" },
  { data: "NAMA_KEC", title: "Nama Kecamatan", width: "180px" },
  { data: "NAMA_KEL", title: "Nama Kelurahan", width: "200px" },
];

export default function Page() {
  return (
    <SearchReqPage
      endpoint="/api/search_req/dktp_f"
      title="Request Cetak KTP (Sudah Cetak) - With Filter"
      subtitle="Filter berdasarkan kecamatan/kelurahan, tanggal request, dan NIK opsional."
      tableTitle="Data Request Sudah Cetak"
      tableId="dt-dktp-f"
      columns={columns}
    />
  );
}
