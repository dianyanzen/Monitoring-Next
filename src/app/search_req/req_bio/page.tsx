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
  { data: "CURRENT_STATUS_CODE", title: "Status E-KTP", className: "dt-body-center", width: "150px" },
  { data: "REQ_DATE", title: "Req Date", className: "dt-body-center", width: "140px" },
  { data: "REQ_BY", title: "Req By", className: "dt-body-center", width: "140px" },
  { data: "PRINTED_DATE", title: "Print Date", className: "dt-body-center", width: "140px" },
  { data: "PRINTED_BY", title: "Print By", className: "dt-body-center", width: "140px" },
  { data: "ALAMAT", title: "Alamat", width: "240px" },
  { data: "RW", title: "Rw", className: "dt-body-center", width: "80px" },
  { data: "RT", title: "Rt", className: "dt-body-center", width: "80px" },
  { data: "KODE_POS", title: "Kode Pos", className: "dt-body-center", width: "100px" },
];

export default function Page() {
  return (
    <SearchReqPage
      endpoint="/api/search_req/req_bio"
      title="Request Perpindahan Monitoring (Req Bio)"
      subtitle="Tanpa filter wajib, bisa disaring kecamatan/kelurahan/tanggal/NIK."
      tableTitle="Data Request Perpindahan"
      tableId="dt-req-bio"
      columns={columns}
    />
  );
}
