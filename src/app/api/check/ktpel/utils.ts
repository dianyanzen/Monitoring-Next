import { execOne, execRows } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

const ALIAS_SEARCH = (process.env.KTPEL_DB_ALIAS || "DB5CETAK").toUpperCase();
const ALIAS_MASTER = (process.env.KTPEL_MASTER_ALIAS || "DB").toUpperCase();
const ALIAS_WKTP = (process.env.KTPEL_WKTP_ALIAS || ALIAS_MASTER).toUpperCase();
const ALIAS_WILAYAH = (process.env.KTPEL_WIL_ALIAS || "DB222").toUpperCase();
const ALIAS_DEMOG_221 =
  (process.env.KTPEL_DEMOG_221_ALIAS || process.env.KTPEL_PUSH_221_ALIAS || process.env.KTPEL_DB221_ALIAS || "DB221").toUpperCase();

export const PUSH_PRIMARY_STATUS = [
  "ENROLL_FAILURE_AT_REGIONAL",
  "PACKET_RETRY",
  "RECEIVED_AT_CENTRAL",
  "PROCESSING",
  "SENT_FOR_ENROLLMENT",
];

export const PUSH_RETRY_STATUS = [
  "ENROLL_FAILURE_AT_CENTRAL",
  "SEARCH_FAILURE_AT_CENTRAL",
  "ADJUDICATE_RECORD",
  "ADJUDICATE_IN_PROCESS",
  "SENT_FOR_DEDUP",
];

export const PUSHABLE_STATUS = [...PUSH_PRIMARY_STATUS, ...PUSH_RETRY_STATUS];
export const PUSH_TARGET_STATUS = "BIO_CAPTURED";

export type KtpelRow = {
  source: "rekam" | "hist" | "wktp";
  nik: string;
  noKk: string | null;
  nama: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  umur: string | null;
  jenisKelamin: string | null;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
  kodePos: string | null;
  jumlahCetak: number;
  namaKecamatan: string | null;
  namaKelurahan: string | null;
  agama: string | null;
  pekerjaan: string | null;
  statusKawin: string | null;
  currentStatus: string | null;
  distribusiTanggal: string | null;
  distribusiOleh: string | null;
  ktpTanggal: string | null;
  ktpOleh: string | null;
  fotoPath: string | null;
  pengajuanTanggal: string | null;
  pengajuanOleh: string | null;
  pengajuanDiprosesOleh: string | null;
  pengajuanStatus: string | null;
  keterangan?: string | null;
  sumberStatus?: string | null;
  wilayahProp?: string | null;
  wilayahKab?: string | null;
  wktp: boolean;
  pushEligible: boolean;
};

export type WilayahOption = {
  value: string;
  label: string;
};

export function getSearchAlias() {
  return ALIAS_SEARCH;
}

export function getWktpAlias() {
  return ALIAS_WKTP;
}

export function getDemog221Alias() {
  return ALIAS_DEMOG_221;
}

export function sanitizeNumberList(raw?: string | null) {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((val) => val.trim())
        .filter(Boolean)
        .map((val) => val.replace(/[^\d]/g, ""))
        .filter(Boolean)
    )
  ).slice(0, 200); // batasi agar query tetap aman
}

export function normalizeDateInput(raw?: string | null) {
  const value = (raw || "").trim();
  if (!value) return null;
  return value;
}

export function normalizeText(raw?: string | null) {
  const value = (raw || "").trim();
  return value ? value.toUpperCase() : null;
}

function s(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toInt(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function mapRekamRow(row: Record<string, any>, source: "rekam" | "hist"): KtpelRow {
  const status = s(row.CURRENT_STATUS_CODE) || null;
  return {
    source,
    nik: s(row.NIK),
    noKk: s(row.NO_KK) || null,
    nama: s(row.NAMA_LGKP) || null,
    tempatLahir: s(row.TMPT_LHR) || null,
    tanggalLahir: s(row.TGL_LHR) || null,
    umur: null,
    jenisKelamin: s(row.JENIS_KLMIN) || null,
    alamat: s(row.ALAMAT) || null,
    rt: s(row.RT) || null,
    rw: s(row.RW) || null,
    kodePos: s(row.KODE_POS) || null,
    jumlahCetak: toInt(row.JUMLAH_CETAK),
    namaKecamatan: s(row.NAMA_KEC) || null,
    namaKelurahan: s(row.NAMA_KEL) || null,
    agama: s(row.AGAMA) || null,
    pekerjaan: s(row.JENIS_PKRJN) || null,
    statusKawin: s(row.STAT_KWN) || null,
    currentStatus: status,
    distribusiTanggal: s(row.DIS_DT) || null,
    distribusiOleh: s(row.DIS_BY) || null,
    ktpTanggal: s(row.KTP_DT) || null,
    ktpOleh: s(row.KTP_BY) || null,
    fotoPath: s(row.PATH) || null,
    pengajuanTanggal: s(row.REQ_DATE) || null,
    pengajuanOleh: s(row.REQ_BY) || null,
    pengajuanDiprosesOleh: s(row.PROC_BY) || null,
    pengajuanStatus: s(row.STEP_PROC) || null,
    wktp: false,
    pushEligible: status ? PUSHABLE_STATUS.includes(status) : false,
  };
}

export function mapWktpRow(row: Record<string, any>): KtpelRow {
  return {
    source: "wktp",
    nik: s(row.NIK),
    noKk: s(row.NO_KK) || null,
    nama: s(row.NAMA_LGKP) || null,
    tempatLahir: s(row.TMPT_LHR) || null,
    tanggalLahir: s(row.TGL_LHR) || null,
    umur: s(row.UMUR) || null,
    jenisKelamin: null,
    alamat: s(row.ALAMAT) || null,
    rt: s(row.RT) || null,
    rw: s(row.RW) || null,
    kodePos: s(row.KODE_POS) || null,
    jumlahCetak: 0,
    namaKecamatan: s(row.NAMA_KEC) || null,
    namaKelurahan: s(row.NAMA_KEL) || null,
    agama: null,
    pekerjaan: null,
    statusKawin: null,
    currentStatus: s(row.CURRENT_STATUS_CODE) || null,
    distribusiTanggal: null,
    distribusiOleh: null,
    ktpTanggal: null,
    ktpOleh: null,
    fotoPath: null,
    pengajuanTanggal: null,
    pengajuanOleh: null,
    pengajuanDiprosesOleh: null,
    pengajuanStatus: null,
    keterangan: s(row.KETERANGAN) || null,
    sumberStatus: s(row.KETERANGAN_REKAM) || null,
    wilayahProp: s(row.NO_PROP) || null,
    wilayahKab: s(row.NO_KAB) || null,
    wktp: true,
    pushEligible: false,
  };
}

export async function fetchAksesFlags() {
  const sql = `
    SELECT SYSTEM_CODE, NVL(SYSTEM_VALUE_NUM, 0) AS VAL
    FROM SIAK_MASTER
    WHERE SYSTEM_TYPE = 'INIT_SETING'
      AND SYSTEM_CODE IN ('GIVE_ALL_KEC', 'GIVE_ALL_KEL')
  `;
  const rows = await execRows<{ SYSTEM_CODE: string; VAL: number }>(sql, {}, {}, ALIAS_MASTER);
  const map = new Map(rows.map((r) => [r.SYSTEM_CODE, Number(r.VAL || 0)]));
  return {
    aksesKecamatan: map.get("GIVE_ALL_KEC") ?? 0,
    aksesKelurahan: map.get("GIVE_ALL_KEL") ?? 0,
  };
}

export async function fetchKecamatan(noProp: string, noKab: string) {
  const sql = `
    SELECT TRIM(TO_CHAR(NO_KEC)) AS NO_KEC,
           TRIM(TO_CHAR(NO_KEC)) || ' - ' || NAMA_KEC AS NAMA_KEC
    FROM SETUP_KEC
    WHERE NO_PROP = :no_prop
      AND NO_KAB = :no_kab
    ORDER BY TO_NUMBER(NO_KEC)
  `;
  const rows = await execRows<{ NO_KEC: string; NAMA_KEC: string }>(
    sql,
    { no_prop: noProp, no_kab: noKab },
    {},
    ALIAS_WILAYAH
  );
  return rows.map<WilayahOption>((r) => ({
    value: r.NO_KEC,
    label: r.NAMA_KEC,
  }));
}

export async function fetchKabupaten(noProp: string) {
  const sql = `
    SELECT TRIM(TO_CHAR(NO_KAB)) AS NO_KAB,
           TRIM(TO_CHAR(NO_KAB)) || ' - ' || NAMA_KAB AS NAMA_KAB
    FROM SETUP_KAB
    WHERE NO_PROP = :no_prop
    ORDER BY TO_NUMBER(NO_KAB)
  `;
  const rows = await execRows<{ NO_KAB: string; NAMA_KAB: string }>(
    sql,
    { no_prop: noProp },
    {},
    ALIAS_WILAYAH
  );
  return rows.map<WilayahOption>((r) => ({
    value: r.NO_KAB,
    label: r.NAMA_KAB,
  }));
}

export async function fetchKelurahan(noProp: string, noKab: string, noKec: string) {
  const sql = `
    SELECT TRIM(TO_CHAR(NO_KEL)) AS NO_KEL,
           TRIM(TO_CHAR(NO_KEL)) || ' - ' || NAMA_KEL AS NAMA_KEL
    FROM SETUP_KEL
    WHERE NO_PROP = :no_prop
      AND NO_KAB = :no_kab
      AND NO_KEC = :no_kec
    ORDER BY TO_NUMBER(NO_KEL)
  `;
  const rows = await execRows<{ NO_KEL: string; NAMA_KEL: string }>(
    sql,
    { no_prop: noProp, no_kab: noKab, no_kec: noKec },
    {},
    ALIAS_WILAYAH
  );
  return rows.map<WilayahOption>((r) => ({
    value: r.NO_KEL,
    label: r.NAMA_KEL,
  }));
}

export function resolveWilayahDefaults(user: SessionUser | null) {
  const noProp = (user?.S_NO_PROP || process.env.KTPEL_DEFAULT_PROP || "32").toString().padStart(2, "0");
  const noKab = (user?.S_NO_KAB || process.env.KTPEL_DEFAULT_KAB || "73").toString().padStart(2, "0");
  const noKec = (user?.S_NO_KEC || "0").toString().padStart(3, "0");
  const noKel = (user?.S_NO_KEL || "0").toString().padStart(3, "0");
  return { noProp, noKab, noKec, noKel };
}

export async function fetchSingleKelurahanName(noProp: string, noKab: string, noKec: string, noKel: string) {
  const sql = `
    SELECT NAMA_KEL
    FROM SETUP_KEL
    WHERE NO_PROP = :no_prop
      AND NO_KAB = :no_kab
      AND NO_KEC = :no_kec
      AND NO_KEL = :no_kel
  `;
  const row = await execOne<{ NAMA_KEL?: string }>(
    sql,
    { no_prop: noProp, no_kab: noKab, no_kec: noKec, no_kel: noKel },
    {},
    ALIAS_WILAYAH
  );
  return row?.NAMA_KEL?.trim() ?? null;
}

export async function fetchSingleKecamatanName(noProp: string, noKab: string, noKec: string) {
  const sql = `
    SELECT NAMA_KEC
    FROM SETUP_KEC
    WHERE NO_PROP = :no_prop
      AND NO_KAB = :no_kab
      AND NO_KEC = :no_kec
  `;
  const row = await execOne<{ NAMA_KEC?: string }>(
    sql,
    { no_prop: noProp, no_kab: noKab, no_kec: noKec },
    {},
    ALIAS_WILAYAH
  );
  return row?.NAMA_KEC?.trim() ?? null;
}
