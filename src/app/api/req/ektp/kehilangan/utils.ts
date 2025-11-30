import { execDml, execRows } from "@/lib/db";

export const ORACLE_ALIAS =
  process.env.DB_ALIAS_KTP_HILANG ?? process.env.DB_ALIAS_EKTP_PERUBAHAN ?? process.env.DB_ALIAS_PRR ?? "DB222";

const NO_PROP = (process.env.NO_PROP ?? "32").trim();
const NO_KAB = (process.env.NO_KAB ?? "73").trim();

export type KehilanganRow = {
  noKec: string;
  nik: string;
  noKk: string;
  namaLengkap: string;
  reqDate: string;
  reqBy: string;
  alasanPengajuan: string;
  noKehilangan: string;
  namaKecamatan: string;
  namaKelurahan: string;
  alamat: string;
  rt: string;
  rw: string;
  kodePos: string;
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

export function normalizeRow(row: Record<string, any>): KehilanganRow {
  return {
    noKec: s(row.NO_KEC),
    nik: s(row.NIK),
    noKk: s(row.NO_KK),
    namaLengkap: s(row.NAMA_LENGKAP),
    reqDate: s(row.REQ_DATE),
    reqBy: s(row.REQ_BY),
    alasanPengajuan: s(row.ALASAN_PENGAJUAN),
    noKehilangan: s(row.NO_KEHILANGAN),
    namaKecamatan: s(row.NAMA_KEC),
    namaKelurahan: s(row.NAMA_KEL),
    alamat: s(row.ALAMAT),
    rt: s(row.RT),
    rw: s(row.RW),
    kodePos: s(row.KODE_POS),
  };
}

export function parseRange(raw?: string | null) {
  const fallback = () => {
    const now = new Date();
    const dmy = now.toISOString().slice(0, 10).split("-").reverse().join("-");
    return { start: dmy, end: dmy };
  };
  if (!raw) return fallback();
  const match = raw.match(/(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})/);
  if (!match) return fallback();
  const start = match[1];
  const end = match[2];
  const isDMY = (v: string) => /^\d{2}-\d{2}-\d{4}$/.test(v);
  if (!isDMY(start) || !isDMY(end)) return fallback();
  return { start, end };
}

export async function fetchList(start: string, end: string, noKec: number) {
  const sql = `
    WITH REQ AS (
      SELECT
        ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC,
        PROC_BY, ALASAN_PENGAJUAN, NO_KEHILANGAN,
        RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) AS RNK
      FROM SIAK_REQ_CETAK_KTP@YZDB
      WHERE STEP_PROC <> 'C'
        AND ALASAN_PENGAJUAN = 'HILANG'
    )
    SELECT
      R.NO_KEC,
      R.NIK,
      D.NO_KK,
      R.NAMA_LENGKAP,
      TO_CHAR(R.REQ_DATE,'YYYY-MM-DD') AS REQ_DATE,
      NVL(R.REQ_BY,'-') AS REQ_BY,
      NVL(R.ALASAN_PENGAJUAN,'-') AS ALASAN_PENGAJUAN,
      NVL(R.NO_KEHILANGAN,'-') AS NO_KEHILANGAN,
      F5_GET_NAMA_KECAMATAN(:no_prop,:no_kab,R.NO_KEC) AS NAMA_KEC,
      F5_GET_NAMA_KELURAHAN(:no_prop,:no_kab,R.NO_KEC,R.NO_KEL) AS NAMA_KEL,
      D.ALAMAT,
      LPAD(TO_CHAR(D.NO_RT),3,'0') AS RT,
      LPAD(TO_CHAR(D.NO_RW),3,'0') AS RW,
      CASE WHEN TO_CHAR(D.KODE_POS) IS NULL THEN '-' ELSE TO_CHAR(D.KODE_POS) END AS KODE_POS
    FROM REQ R
    JOIN DEMOGRAPHICS_ALL@DB5CETAK D ON D.NIK = R.NIK
    WHERE R.RNK = 1
      AND R.REQ_DATE >= TO_DATE(:b_start,'DD-MM-YYYY')
      AND R.REQ_DATE < TO_DATE(:b_end,'DD-MM-YYYY') + 1
      AND (:no_kec = 0 OR R.NO_KEC = :no_kec)
    ORDER BY R.REQ_DATE DESC, R.NIK
  `;

  const rows = await execRows(
    sql,
    { b_start: start, b_end: end, no_kec: noKec, no_prop: NO_PROP, no_kab: NO_KAB },
    {},
    ORACLE_ALIAS
  );
  return rows.map(normalizeRow);
}

export async function updateNoKehilangan(nik: string, noKehilangan: string) {
  const sql = `
    UPDATE SIAK_REQ_CETAK_KTP
    SET KEHILANGAN = 1,
        NO_KEHILANGAN = :no_kehilangan
    WHERE NIK = :nik
      AND ALASAN_PENGAJUAN = 'HILANG'
      AND STEP_PROC <> 'C'
  `;
  return execDml(sql, { nik, no_kehilangan: noKehilangan.toUpperCase() }, {}, ORACLE_ALIAS);
}
