import { execOne, execRows, execDml } from "@/lib/db";
import type { SessionUser } from "@/lib/session";

export const ORACLE_ALIAS =
  process.env.DB_ALIAS_KTPLD ?? process.env.DB_ALIAS_EKTP_PERUBAHAN ?? process.env.DB_ALIAS_PRR ?? "DB222";
const MASTER_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
const WILAYAH_ALIAS = process.env.DB_ALIAS_WILAYAH ?? "DB222";

const NO_PROP = (process.env.NO_PROP ?? "32").trim();
const NO_KAB = (process.env.NO_KAB ?? "73").trim();

export type DetailRow = {
  nik: string;
  nama: string;
  noKec: string;
  namaKec: string;
  reqDate?: string | null;
  source: "pengajuan" | "demog";
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());
const sanitizeDigits = (v: string) => v.replace(/[^\d]/g, "");

export function sanitizeNik(raw?: string | null) {
  return sanitizeDigits((raw ?? "").toString()).slice(0, 16);
}

export function sanitizeNoKec(raw?: string | number | null) {
  const cleaned = sanitizeDigits((raw ?? "").toString());
  return cleaned ? cleaned : "";
}

export function resolveDefaultNoKec(session: SessionUser | null) {
  const raw = session?.S_NO_KEC;
  const cleaned = sanitizeNoKec(raw as any);
  return cleaned || "";
}

export async function fetchDemogByNik(nik: string) {
  const sql = `
    SELECT
      TRIM(TO_CHAR(NIK)) AS NIK,
      TRIM(NAMA_LGKP) AS NAMA_LGKP,
      TRIM(TO_CHAR(NO_KEC)) AS NO_KEC,
      TRIM(NAMA_KEC) AS NAMA_KEC
    FROM DEMOGRAPHICS_ALL@DB5CETAK
    WHERE NIK = :nik AND NO_PROP = 32 AND NO_KEC = 73
  `;
  const row = await execOne<{
    NIK?: string;
    NAMA_LGKP?: string;
    NO_KEC?: string | number;
    NAMA_KEC?: string;
  }>(sql, { nik }, {}, ORACLE_ALIAS);
  if (!row) return null;
  return {
    nik: toStr(row.NIK),
    nama: toStr(row.NAMA_LGKP),
    noKec: toStr(row.NO_KEC),
    namaKec: toStr(row.NAMA_KEC),
    source: "demog" as const,
  };
}

export async function fetchPengajuanByNik(nik: string) {
  const sql = `
    SELECT
      TRIM(TO_CHAR(NIK)) AS NIK,
      TRIM(NAMA_LENGKAP) AS NAMA_LGKP,
      TRIM(TO_CHAR(NO_KEC)) AS NO_KEC,
      F5_GET_NAMA_KECAMATAN(:no_prop, :no_kab, NO_KEC) AS NAMA_KEC,
      TO_CHAR(REQ_DATE,'DD-MM-YYYY') AS REQ_DATE
    FROM (
      SELECT
        NIK, NAMA_LENGKAP, NO_KEC, REQ_DATE,
        ROW_NUMBER() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) AS RNK
      FROM SIAK_REQ_CETAK_KTPLD
      WHERE NIK = :nik
    )
    WHERE RNK = 1
  `;
  const row = await execOne<{
    NIK?: string;
    NAMA_LGKP?: string;
    NO_KEC?: string | number;
    NAMA_KEC?: string;
    REQ_DATE?: string;
  }>(sql, { nik, no_prop: NO_PROP, no_kab: NO_KAB }, {}, ORACLE_ALIAS);
  if (!row) return null;
  return {
    nik: toStr(row.NIK),
    nama: toStr(row.NAMA_LGKP),
    noKec: toStr(row.NO_KEC),
    namaKec: toStr(row.NAMA_KEC),
    reqDate: toStr(row.REQ_DATE),
    source: "pengajuan" as const,
  };
}

export async function fetchAksesKecamatan() {
  const sql = `
    SELECT NVL(MAX(SYSTEM_VALUE_NUM), 0) AS VAL
    FROM SIAK_MASTER
    WHERE SYSTEM_TYPE = 'INIT_SETING'
      AND SYSTEM_CODE = 'GIVE_ALL_KEC'
  `;
  const row = await execOne<{ VAL?: number }>(sql, {}, {}, MASTER_ALIAS);
  return Number(row?.VAL ?? 0);
}

export async function fetchKecamatanOptions() {
  const sql = `
    SELECT TRIM(TO_CHAR(NO_KEC)) AS NO_KEC,
           TRIM(TO_CHAR(NO_KEC)) || ' - ' || NAMA_KEC AS NAMA_KEC
    FROM SETUP_KEC
    WHERE NO_PROP = :no_prop
      AND NO_KAB = :no_kab
    ORDER BY TO_NUMBER(NO_KEC)
  `;
  const rows = await execRows<{ NO_KEC?: string | number; NAMA_KEC?: string }>(
    sql,
    { no_prop: NO_PROP, no_kab: NO_KAB },
    {},
    WILAYAH_ALIAS
  );
  return rows.map((r) => ({
    value: toStr(r.NO_KEC),
    label: toStr(r.NAMA_KEC),
  }));
}

export async function insertPengajuanLd(nik: string, nama: string, noKec: string, userId: string) {
  const sql = `
    INSERT INTO SIAK_REQ_CETAK_KTPLD (
      NIK, NAMA_LENGKAP, NO_KEC, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, ID_CETAK
    )
    SELECT
      :nik,
      :nama,
      :no_kec,
      SYSDATE,
      :req_by,
      NULL,
      NULL,
      'A',
      CONCAT(CONCAT(CONCAT(TRUNC(DBMS_RANDOM.VALUE(1000000000,9999999999)),'-'),TRUNC(DBMS_RANDOM.VALUE(1000000000,9999999999))),:nik)
    FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM SIAK_REQ_CETAK_KTPLD D WHERE D.NIK = :nik AND D.STEP_PROC = 'A')
  `;
  return execDml(sql, { nik, nama, no_kec: noKec, req_by: userId }, {}, ORACLE_ALIAS);
}

export async function updatePengajuanLd(nik: string, userId: string, nama?: string, noKec?: string) {
  const assignments = ["REQ_DATE = SYSDATE", "REQ_BY = :req_by", "STEP_PROC = 'A'"];
  const binds: Record<string, any> = { nik, req_by: userId };
  if (nama) {
    assignments.push("NAMA_LENGKAP = :nama");
    binds.nama = nama;
  }
  if (noKec) {
    assignments.push("NO_KEC = :no_kec");
    binds.no_kec = noKec;
  }
  const sql = `
    UPDATE SIAK_REQ_CETAK_KTPLD
    SET ${assignments.join(", ")}
    WHERE NIK = :nik
  `;
  return execDml(sql, binds, {}, ORACLE_ALIAS);
}

export async function deletePengajuanLd(nik: string) {
  const sql = `DELETE FROM SIAK_REQ_CETAK_KTPLD WHERE NIK = :nik`;
  return execDml(sql, { nik }, {}, ORACLE_ALIAS);
}
