import type { SessionUser } from "@/lib/session";

const BLOCKED_STATUS = [
  "UNREGISTERED",
  "BIO_CAPTURED",
  "ENROLL_FAILURE_AT_REGIONAL",
  "PACKET_RETRY",
  "RECEIVED_AT_CENTRAL",
  "PROCESSING",
  "SENT_FOR_ENROLLMENT",
  "ENROLL_FAILURE_AT_CENTRAL",
  "MISSING_BIOMETRIC_EXCEPTION",
  "INVALID_PACKET",
  "SEARCH_FAILURE_AT_CENTRAL",
  "ADJUDICATE_RECORD",
  "ADJUDICATE_IN_PROCESS",
  "SENT_FOR_DEDUP",
  "DUPLICATE_RECORD",
  "PRINT_READY_RECORD",
];

export const STATUS_ALLOWED = BLOCKED_STATUS;
export const STATUS_REJECTED = BLOCKED_STATUS;

export function sanitizeNikList(raw?: string | null) {
  if (!raw) return [];
  const cleaned = raw
    .trim()
    .replace(/^[,\s]+/, "")
    .replace(/[^\d,]/g, "")
    .replace(/,+/g, ",")
    .replace(/(^,|,$)/g, "");

  if (!cleaned) return [];
  const parts = cleaned
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.replace(/[^\d]/g, ""));

  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const val of parts) {
    if (!seen.has(val)) {
      seen.add(val);
      uniq.push(val);
    }
    if (uniq.length >= 200) break; // batasi agar query aman
  }
  return uniq;
}

export function buildInClause(values: string[], prefix = "nik") {
  const names: string[] = [];
  const binds: Record<string, any> = {};
  values.forEach((v, i) => {
    const key = `${prefix}${i}`;
    names.push(`:${key}`);
    binds[key] = v;
  });
  return { clause: names.join(","), binds };
}

export function normalizeRow(row: Record<string, any>) {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
  return {
    noKec: s(row.NO_KEC),
    nik: s(row.NIK),
    noKk: s(row.NO_KK),
    namaLengkap: s(row.NAMA_LENGKAP),
    tempatLahir: s(row.TMPT_LHR),
    tanggalLahir: s(row.TGL_LHR),
    alamat: s(row.ALAMAT),
    kodePos: s(row.KODE_POS),
    rt: s(row.RT),
    rw: s(row.RW),
    statusEktp: s(row.CURRENT_STATUS_CODE),
    reqDate: s(row.REQ_DATE),
    reqBy: s(row.REQ_BY),
    alasanPengajuan: s(row.ALASAN_PENGAJUAN),
    statusPengajuan: s(row.STATUS_PENGAJUAN),
    keteranganPengajuan: s(row.KETERANGAN_STATUS),
    printDate: s(row.PRINTED_DATE),
    printBy: s(row.PRINTED_BY),
    namaKecamatan: s(row.NAMA_KEC),
    namaKelurahan: s(row.NAMA_KEL),
    agama: s(row.AGAMA),
    pekerjaan: s(row.JENIS_PKRJN),
    statusKawin: s(row.STAT_KWN),
  };
}

export function resolveNoKec(session: SessionUser | null) {
  const raw = session?.S_NO_KEC;
  if (!raw) return null;
  const num = Number(String(raw).trim());
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function resolveReason(reqStatus: number | null | undefined) {
  if (reqStatus === 4) return "KEDATANGAN LUAR KOTA";
  if (reqStatus === 3) return "HILANG";
  if (reqStatus === 2) return "RUSAK";
  return "PERUBAHAN ELEMEN";
}
