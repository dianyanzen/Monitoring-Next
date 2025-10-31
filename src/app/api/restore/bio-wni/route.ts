// FILE: src/app/api/restore/bio-wni/route.ts
// catatan:
// - route ini tetap pakai alias utama (DB) untuk semua query SIAK
// - fallback foto TIDAK lagi lewat dblink `FACES@DB5CETAK` (karena ORA-65510)
// - fallback foto sekarang pakai koneksi terpisah langsung ke alias Oracle `DB5CETAK`
// - kalau di T5_FOTO tidak ada, dan di FACES (DB5CETAK) juga tidak ada → pakai placeholder

import type { NextRequest } from "next/server";
import { ok, badRequest, err, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows, execOne } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/restore/bio-wni";
const ORACLE_ALIAS = process.env.DB_ALIAS_RESTORE ?? "DB";
const FACE_DB_ALIAS = process.env.DB_ALIAS_FACE ?? "DB5CETAK";
const DEMOGRAPHICS_DB_ALIAS = process.env.DB_ALIAS_DEMOGRAPHICS ?? ORACLE_ALIAS;

/* =========================================================
   Types
   ========================================================= */
type RestorePayload = {
  nik?: string | number;
  noKk?: string | number;
  noKec?: string | number;
};

type RestorePerson = {
  nik: string;
  noKk: string;
  namaLgkp: string;
  tmptLhr: string | null;
  tglLhr: string | null;
  noKec: number | null;
  noKel: number | null;
  aktaLhr: string | null;
  noAktaLhr: string | null;
  namaIbu: string | null;
  namaAyah: string | null;
  flagStatus: "AKTIF" | "TIDAK AKTIF";
  namaKec: string | null;
  namaKel: string | null;
  alamat: string | null;
  rt: string | null;
  rw: string | null;
  namaKep: string | null;
  statHubkel: string | null;
  jenisKelamin: string | null;
  currentStatusCode: string | null;
  ket: string | null;
  path: string | null;
  photoSource?: "T5_FOTO" | "FACES" | "PLACEHOLDER";
  faceBase64?: string | null;
  faceMime?: string | null;
  alasan?: string | null;
  descAlasan?: string | null;
  deletedBy?: string | null;
  deletedAt?: string | null;
};

type RestoreFamily = {
  nik: string;
  noKk: string;
  statHubkel: string | null;
  statHbkel?: string | null;
  namaLgkp: string;
  tglLhr: string | null;
  namaKecamatan: string | null;
  namaKelurahan: string | null;
  currentStatusCode: string | null;
  flagStatus: string | null;
  deletedBy: string | null;
};

type PindahHistory = {
  noPindah: string | null;
  klasifikasiPindah: string | null;
  dari: {
    provinsi: string | null;
    kabupaten: string | null;
    kecamatan: string | null;
    kelurahan: string | null;
  };
  tujuan: {
    provinsi: string | null;
    kabupaten: string | null;
    kecamatan: string | null;
    kelurahan: string | null;
  };
  tanggal: string | null;
};

type RestoreResponse = {
  source: "ACTIVE" | "DELETED" | "ARCHIVE" | "FAMILY_ONLY" | "NONE";
  person: RestorePerson | null;
  family: RestoreFamily[];
  historyPindah: PindahHistory | null;
  historyKematian: string | null;
};

/* =========================================================
   SQL – master person
   ========================================================= */
const SQL_PERSON_ACTIVE = (withKec: boolean) => `
  SELECT
    A.NIK AS NIK,
    A.NO_KK AS NO_KK,
    A.NAMA_LGKP AS NAMA_LGKP,
    A.TMPT_LHR AS TMPT_LHR,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_KEC AS NO_KEC,
    A.NO_KEL AS NO_KEL,
    A.AKTA_LHR AS AKTA_LHR,
    A.NO_AKTA_LHR AS NO_AKTA_LHR,
    A.NAMA_LGKP_IBU AS NAMA_LGKP_IBU,
    A.NAMA_LGKP_AYAH AS NAMA_LGKP_AYAH,
    CASE WHEN A.FLAG_STATUS = 0 THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    F5_GET_NAMA_KECAMATAN(A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KEC,
    F5_GET_NAMA_KELURAHAN(A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KEL,
    CASE WHEN D.NO_RT IS NULL THEN '-' ELSE LPAD(TO_CHAR(D.NO_RT), 3, '0') END AS RT,
    CASE WHEN D.NO_RW IS NULL THEN '-' ELSE LPAD(TO_CHAR(D.NO_RW), 3, '0') END AS RW,
    CASE WHEN D.ALAMAT IS NULL THEN '-' ELSE D.ALAMAT END AS ALAMAT,
    CASE WHEN D.NAMA_KEP IS NULL THEN '-' ELSE D.NAMA_KEP END AS NAMA_KEP,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HBKEL,
    CASE WHEN A.JENIS_KLMIN = 1 THEN 'LAKI-LAKI' ELSE 'PEREMPUAN' END AS JENIS_KLMIN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'BELUM REKAM' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    'AKTIF DI SIAK' AS KET,
    CASE WHEN E.PATH IS NULL THEN '-' ELSE E.PATH END AS PATH
  FROM BIODATA_WNI A
  LEFT JOIN DATA_KELUARGA D ON A.NO_KK = D.NO_KK
  LEFT JOIN DEMOGRAPHICS_ALL@DB5CETAK B ON A.NIK = B.NIK
  LEFT JOIN T5_FOTO E ON A.NIK = E.NIK
  WHERE A.NIK = :b_nik
  ${withKec ? "AND A.NO_KEC = :b_no_kec" : ""}
`;

const SQL_PERSON_DELETE = (withKec: boolean) => `
  SELECT
    A.NIK AS NIK,
    A.NO_KK AS NO_KK,
    A.NAMA_LGKP AS NAMA_LGKP,
    A.TMPT_LHR AS TMPT_LHR,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_KEC AS NO_KEC,
    A.NO_KEL AS NO_KEL,
    A.AKTA_LHR AS AKTA_LHR,
    A.NO_AKTA_LHR AS NO_AKTA_LHR,
    A.NAMA_LGKP_IBU AS NAMA_LGKP_IBU,
    A.NAMA_LGKP_AYAH AS NAMA_LGKP_AYAH,
    CASE WHEN A.FLAG_STATUS = 0 THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    F5_GET_NAMA_KECAMATAN(A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KEC,
    F5_GET_NAMA_KELURAHAN(A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KEL,
    CASE WHEN D.NO_RT IS NULL THEN (CASE WHEN C.NO_RT IS NULL THEN '-' ELSE LPAD(TO_CHAR(C.NO_RT), 3, '0') END) ELSE LPAD(TO_CHAR(D.NO_RT), 3, '0') END AS RT,
    CASE WHEN D.NO_RW IS NULL THEN (CASE WHEN C.NO_RW IS NULL THEN '-' ELSE LPAD(TO_CHAR(C.NO_RW), 3, '0') END) ELSE LPAD(TO_CHAR(D.NO_RW), 3, '0') END AS RW,
    CASE WHEN D.ALAMAT IS NULL THEN (CASE WHEN C.ALAMAT IS NULL THEN '-' ELSE C.ALAMAT END) ELSE D.ALAMAT END AS ALAMAT,
    CASE WHEN D.NAMA_KEP IS NULL THEN (CASE WHEN C.NAMA_KEP IS NULL THEN '-' ELSE C.NAMA_KEP END) ELSE D.NAMA_KEP END AS NAMA_KEP,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HBKEL,
    CASE WHEN A.JENIS_KLMIN = 1 THEN 'LAKI-LAKI' ELSE 'PEREMPUAN' END AS JENIS_KLMIN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'BELUM REKAM' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    'TIDAK AKTIF DI SIAK' AS KET,
    CASE WHEN E.PATH IS NULL THEN '-' ELSE E.PATH END AS PATH,
    CASE WHEN Y.ALASAN IS NULL THEN '-' ELSE Y.ALASAN END AS ALASAN,
    CASE WHEN Y.DESC_ALASAN IS NULL THEN '-' ELSE Y.DESC_ALASAN END AS DESC_ALASAN,
    CASE WHEN Y.CREATED_BY IS NULL THEN '-' ELSE UPPER(Y.CREATED_BY) END AS CREATED_BY,
    CASE WHEN Y.TGL_DELETE IS NULL THEN TO_CHAR(A.DELETED_DATE,'DD-MM-YYYY') ELSE Y.TGL_DELETE END AS DELETE_DT
  FROM BIODATA_WNI_DELETE A
  LEFT JOIN DATA_KELUARGA_MASTER D ON A.NO_KK = D.NO_KK
  LEFT JOIN DATA_KELUARGA_DELETE C ON A.NO_KK = C.NO_KK
  LEFT JOIN DEMOGRAPHICS_ALL@DB5CETAK B ON A.NIK = B.NIK
  LEFT JOIN T5_FOTO E ON A.NIK = E.NIK
  LEFT JOIN BIODATA_WNI X ON A.NIK = X.NIK
  LEFT JOIN (
    SELECT ID_TABLE, TBL_REF, ALASAN,
           CASE WHEN DESC_ALASAN IS NULL THEN '-' ELSE UPPER(DESC_ALASAN) END AS DESC_ALASAN,
           REF_DELETE_KEY, CREATED_BY, TO_CHAR(CREATED_DATE,'DD-MM-YYYY') AS TGL_DELETE, REF_DELETE
    FROM (
      SELECT ID_TABLE, TBL_REF, ALASAN, DESC_ALASAN, REF_DELETE_KEY,
             CREATED_BY, CREATED_DATE, REF_DELETE,
             RANK() OVER (PARTITION BY REF_DELETE_KEY ORDER BY CREATED_DATE DESC, ID_TABLE DESC) RNK
      FROM T7_NOTE_DELETE
    )
    WHERE RNK = 1 AND REF_DELETE = 'BIODATA_WNI'
  ) Y ON A.NIK = Y.REF_DELETE_KEY
  WHERE A.NIK = :b_nik
    AND X.NIK IS NULL
  ${withKec ? "AND A.NO_KEC = :b_no_kec" : ""}
`;

const SQL_PERSON_DEMOGRAPHICS = `
  SELECT
    TO_CHAR(A.NIK) AS NIK,
    TO_CHAR(A.NO_KK) AS NO_KK,
    A.NAMA_LGKP,
    A.TMPT_LHR,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_PROP,
    A.NO_KAB,
    A.NO_KEC,
    A.NO_KEL,
    A.NAMA_PROP,
    A.NAMA_KAB,
    A.NAMA_KEC,
    A.NAMA_KEL,
    A.CURRENT_STATUS_CODE,
    A.NAMA_LGKP_IBU,
    A.NAMA_LGKP_AYAH,
    A.JENIS_KLMIN,
    A.ALAMAT,
    A.NO_RT,
    A.NO_RW,
    A.NAMA_KEP,
    A.NO_AKTA_LHR,
    A.AKTA_LHR,
    A.FLAG_STATUS,
    A.STAT_HBKEL,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL
  FROM BMUSER.DEMOGRAPHICS_ALL@DB5CETAK A
  WHERE A.NIK = :b_nik
`;

const SQL_DEMOGRAPHICS_FAMILY_BY_NOKK = `
  SELECT
    TO_CHAR(A.NIK) AS NIK,
    TO_CHAR(A.NO_KK) AS NO_KK,
    A.NAMA_LGKP,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL,
    A.STAT_HBKEL AS STAT_HBKEL_CODE,
    A.CURRENT_STATUS_CODE,
    CASE WHEN A.FLAG_STATUS = '0' OR UPPER(A.FLAG_STATUS) = 'A' THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    F5_GET_NAMA_KECAMATAN(A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KEC,
    F5_GET_NAMA_KELURAHAN(A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KEL
  FROM BMUSER.DEMOGRAPHICS_ALL@DB5CETAK A
  WHERE A.NO_KK = :b_no_kk
  ORDER BY A.STAT_HBKEL
`;

const SQL_DEMOGRAPHICS_FAMILY_BY_NIK = `
  SELECT
    TO_CHAR(A.NIK) AS NIK,
    TO_CHAR(A.NO_KK) AS NO_KK,
    A.NAMA_LGKP,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL,
    A.STAT_HBKEL AS STAT_HBKEL_CODE,
    A.CURRENT_STATUS_CODE,
    CASE WHEN A.FLAG_STATUS = '0' OR UPPER(A.FLAG_STATUS) = 'A' THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    F5_GET_NAMA_KECAMATAN(A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KEC,
    F5_GET_NAMA_KELURAHAN(A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KEL
  FROM BMUSER.DEMOGRAPHICS_ALL A
  WHERE A.NO_KK = (
    SELECT NO_KK FROM BMUSER.DEMOGRAPHICS_ALL@DB5CETAK WHERE NIK = :b_nik FETCH FIRST 1 ROWS ONLY
  )
  ORDER BY A.STAT_HBKEL
`;

/* =========================================================
   SQL – family
   ========================================================= */
const SQL_FAMILY_BY_NIK = `
  SELECT
    A.NIK,
    A.NO_KK,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL,
    A.STAT_HBKEL,
    A.NAMA_LGKP,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_KEC,
    A.NO_KEL,
    F5_GET_NAMA_KECAMATAN (A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KECAMATAN,
    F5_GET_NAMA_KELURAHAN (A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KELURAHAN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'BELUM REKAM' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    CASE WHEN A.FLAG_STATUS = 0 THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    'TIDAK AKTIF DI SIAK' AS DELETED_BY
  FROM BIODATA_WNI_DELETE A
  LEFT JOIN DEMOGRAPHICS_ALL@DB5CETAK B ON A.NIK = B.NIK
  WHERE A.NO_KK IN (SELECT C.NO_KK FROM BIODATA_WNI C WHERE C.NIK = :b_nik)
  UNION ALL
  SELECT
    A.NIK,
    A.NO_KK,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL,
    A.STAT_HBKEL,
    A.NAMA_LGKP,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_KEC,
    A.NO_KEL,
    F5_GET_NAMA_KECAMATAN (A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KECAMATAN,
    F5_GET_NAMA_KELURAHAN (A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KELURAHAN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'BELUM REKAM' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    CASE WHEN A.FLAG_STATUS = 0 THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    'AKTIF DI SIAK' AS DELETED_BY
  FROM BIODATA_WNI A
  LEFT JOIN DEMOGRAPHICS_ALL@DB5CETAK B ON A.NIK = B.NIK
  WHERE A.NO_KK IN (SELECT C.NO_KK FROM BIODATA_WNI C WHERE C.NIK = :b_nik)
  ORDER BY STAT_HBKEL
`;

const SQL_FAMILY_BY_NOKK = `
  SELECT
    A.NIK,
    A.NO_KK,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL,
    A.STAT_HBKEL,
    A.NAMA_LGKP,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_KEC,
    A.NO_KEL,
    F5_GET_NAMA_KECAMATAN (A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KECAMATAN,
    F5_GET_NAMA_KELURAHAN (A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KELURAHAN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'BELUM REKAM' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    CASE WHEN A.FLAG_STATUS = 0 THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    'TIDAK AKTIF DI SIAK' AS DELETED_BY
  FROM BIODATA_WNI_DELETE A
  LEFT JOIN DEMOGRAPHICS_ALL@DB5CETAK B ON A.NIK = B.NIK
  WHERE A.NO_KK = :b_no_kk
  UNION ALL
  SELECT
    A.NIK,
    A.NO_KK,
    UPPER(F5_GET_REF_WNI(A.STAT_HBKEL, 301)) AS STAT_HUBKEL,
    A.STAT_HBKEL,
    A.NAMA_LGKP,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.NO_KEC,
    A.NO_KEL,
    F5_GET_NAMA_KECAMATAN (A.NO_PROP,A.NO_KAB,A.NO_KEC) AS NAMA_KECAMATAN,
    F5_GET_NAMA_KELURAHAN (A.NO_PROP,A.NO_KAB,A.NO_KEC,A.NO_KEL) AS NAMA_KELURAHAN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'BELUM REKAM' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    CASE WHEN A.FLAG_STATUS = 0 THEN 'AKTIF' ELSE 'TIDAK AKTIF' END AS FLAG_STATUS,
    'AKTIF DI SIAK' AS DELETED_BY
  FROM BIODATA_WNI A
  LEFT JOIN DEMOGRAPHICS_ALL@DB5CETAK B ON A.NIK = B.NIK
  WHERE A.NO_KK = :b_no_kk
  ORDER BY STAT_HBKEL
`;

/* =========================================================
   SQL – history
   ========================================================= */
const SQL_HISTORY_PINDAH = `
  SELECT *
  FROM (
    SELECT
      A.NO_PINDAH,
      A.KLASIFIKASI_PINDAH,
      A.NO_PROP_ASAL,
      A.NO_KAB_ASAL,
      A.NO_KEC_ASAL,
      A.NO_KEL_ASAL,
      A.NO_PROP_TUJUAN,
      A.NO_KAB_TUJUAN,
      A.NO_KEC_TUJUAN,
      A.NO_KEL_TUJUAN,
      F5_GET_NAMA_PROVINSI (A.NO_PROP_ASAL) AS DARI_NAMA_PROVINSI,
      F5_GET_NAMA_KABUPATEN (A.NO_PROP_ASAL,A.NO_KAB_ASAL) AS DARI_NAMA_KABUPATEN,
      F5_GET_NAMA_KECAMATAN (A.NO_PROP_ASAL,A.NO_KAB_ASAL,A.NO_KEC_ASAL) AS DARI_NAMA_KECAMATAN,
      F5_GET_NAMA_KELURAHAN (A.NO_PROP_ASAL,A.NO_KAB_ASAL,A.NO_KEC_ASAL,A.NO_KEL_ASAL) AS DARI_NAMA_KELURAHAN,
      F5_GET_NAMA_PROVINSI (A.NO_PROP_TUJUAN) AS TUJUAN_NAMA_PROVINSI,
      F5_GET_NAMA_KABUPATEN (A.NO_PROP_TUJUAN,A.NO_KAB_TUJUAN) AS TUJUAN_NAMA_KABUPATEN,
      F5_GET_NAMA_KECAMATAN (A.NO_PROP_TUJUAN,A.NO_KAB_TUJUAN,A.NO_KEC_TUJUAN) AS TUJUAN_NAMA_KECAMATAN,
      F5_GET_NAMA_KELURAHAN (A.NO_PROP_TUJUAN,A.NO_KAB_TUJUAN,A.NO_KEC_TUJUAN,A.NO_KEL_TUJUAN) AS TUJUAN_NAMA_KELURAHAN,
      TO_CHAR(A.TGL_PINDAH,'DD-MM-YYYY') AS CREATED_DATE,
      RANK() OVER (PARTITION BY A.NIK ORDER BY A.TGL_PINDAH DESC, A.NO_PINDAH DESC) AS RNK
    FROM SIAK_BNBA_PINDAH A
    WHERE A.NO_PROP_ASAL = 32
      AND A.NO_KAB_ASAL = 73
      AND A.NIK = :b_nik
  )
  WHERE RNK = 1
`;

const SQL_HISTORY_KEMATIAN = `
  SELECT CONCAT(CONCAT('NIK : ',MATI_NIK), CONCAT('<br> TELAH DICATATAKAN AKTA KEMATIANNYA <br>DENGAN NO AKTA : ',ADM_AKTA_NO)) AS KET
  FROM SIAK_BNBA_AKTA_MATI
  WHERE MATI_NIK = :b_nik
`;

/* =========================================================
   SQL – exists
   ========================================================= */
const SQL_EXISTS_ACTIVE = (withKec: boolean) => `
  SELECT COUNT(1) AS JML
  FROM BIODATA_WNI
  WHERE NIK = :b_nik
  ${withKec ? "AND NO_KEC = :b_no_kec" : ""}
`;

const SQL_EXISTS_DELETE = (withKec: boolean) => `
  SELECT COUNT(1) AS JML
  FROM BIODATA_WNI_DELETE A
  LEFT JOIN BIODATA_WNI X ON A.NIK = X.NIK
  WHERE A.NIK = :b_nik
    AND X.NIK IS NULL
  ${withKec ? "AND A.NO_KEC = :b_no_kec" : ""}
`;

/* =========================================================
   SQL – faces (terpisah, ke alias DB5CETAK langsung)
   ========================================================= */
const SQL_FACE_BY_NIK = `
  SELECT FACE, IMAGE_TYPE_CODE
  FROM FACES
  WHERE NIK = :b_nik
`;

/* =========================================================
   Helpers
   ========================================================= */
function normalizeDigits(input?: string | number | null): string {
  if (input === undefined || input === null) return "";
  return String(input).replace(/\D/g, "");
}

function normalizeKecamatan(input?: string | number | null): number | null {
  const raw = normalizeDigits(input);
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

async function hasActiveRecord(nik: string, noKec: number | null): Promise<boolean> {
  const sql = SQL_EXISTS_ACTIVE(Boolean(noKec));
  const binds: Record<string, unknown> = { b_nik: nik };
  if (noKec) binds.b_no_kec = noKec;
  const row = await execOne<{ JML?: number }>(sql, binds, {}, ORACLE_ALIAS);
  return Number(row?.JML ?? 0) > 0;
}

async function hasDeletedRecord(nik: string, noKec: number | null): Promise<boolean> {
  const sql = SQL_EXISTS_DELETE(Boolean(noKec));
  const binds: Record<string, unknown> = { b_nik: nik };
  if (noKec) binds.b_no_kec = noKec;
  const row = await execOne<{ JML?: number }>(sql, binds, {}, ORACLE_ALIAS);
  return Number(row?.JML ?? 0) > 0;
}

// ini yang baru: ambil BLOB foto pakai koneksi terpisah
async function fetchFaceFromDb5Direct(nik: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const rows = await execRows(SQL_FACE_BY_NIK, { b_nik: nik }, {}, FACE_DB_ALIAS);
    if (!rows.length) return null;
    const r = rows[0] as any;
      if (!r.FACE) return null;

      const buff = Buffer.isBuffer(r.FACE) ? r.FACE : Buffer.from(r.FACE);
    const base64 = buff.toString("base64");

    // ⬇️ KUNCI: trim + default ke image/jpeg
    const rawCode = (r.IMAGE_TYPE_CODE ?? "").toString().trim().toLowerCase();
    const mime =
      rawCode === "jpeg" ||
      rawCode === "jpg" ||
      rawCode === "image/jpeg" ||
      rawCode === "image/jpg"
        ? "image/jpeg"
        : rawCode === "png" || rawCode === "image/png"
        ? "image/png"
        : "image/jpeg";

    return { base64, mime };
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "RESTORE.BIO.WNI FACE FETCH FAILED",
      at: AT,
      user: "SYSTEM",
      tookMs: 0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
      extra: { nik, alias: FACE_DB_ALIAS },
    });
    return null;
  }
}

function formatRwRt(val: unknown): string {
  if (val === null || val === undefined) return "-";
  const num = Number(val);
  if (!Number.isFinite(num)) {
    const raw = String(val).trim();
    return raw ? raw : "-";
  }
  return num.toString().padStart(3, "0");
}

function normalizeFlag(flag: unknown): "AKTIF" | "TIDAK AKTIF" {
  const raw = String(flag ?? "").trim();
  return raw === "0" || raw === "A" ? "AKTIF" : "TIDAK AKTIF";
}

function normalizeJenisKelamin(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const val = String(raw).trim();
  if (!val) return null;
  if (val === "1" || val.toUpperCase() === "L") return "LAKI-LAKI";
  if (val === "2" || val.toUpperCase() === "P") return "PEREMPUAN";
  if (val.toUpperCase() === "LAKI-LAKI" || val.toUpperCase() === "PEREMPUAN") return val.toUpperCase();
  return val;
}

function toNumberOrNull(raw: unknown): number | null {
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

async function fetchFamilyDemographicsByNoKk(noKk: string): Promise<RestoreFamily[]> {
  if (!noKk) return [];
  const rows = await execRows(SQL_DEMOGRAPHICS_FAMILY_BY_NOKK, { b_no_kk: noKk }, {}, DEMOGRAPHICS_DB_ALIAS);
  return rows.map((row) => {
    const r = row as Record<string, any>;
    return {
      nik: r.NIK,
      noKk: r.NO_KK,
      statHubkel: r.STAT_HUBKEL,
      statHbkel: r.STAT_HBKEL_CODE !== undefined && r.STAT_HBKEL_CODE !== null ? String(r.STAT_HBKEL_CODE) : null,
      namaLgkp: r.NAMA_LGKP,
      tglLhr: r.TGL_LHR,
      namaKecamatan: r.NAMA_KEC ?? null,
      namaKelurahan: r.NAMA_KEL ?? null,
      currentStatusCode: r.CURRENT_STATUS_CODE ?? null,
      flagStatus: r.FLAG_STATUS ?? null,
      deletedBy: null,
    };
  });
}

async function fetchFamilyDemographicsByNik(nik: string): Promise<RestoreFamily[]> {
  if (!nik) return [];
  const rows = await execRows(SQL_DEMOGRAPHICS_FAMILY_BY_NIK, { b_nik: nik }, {}, DEMOGRAPHICS_DB_ALIAS);
  return rows.map((row) => {
    const r = row as Record<string, any>;
    return {
      nik: r.NIK,
      noKk: r.NO_KK,
      statHubkel: r.STAT_HUBKEL,
      statHbkel: r.STAT_HBKEL_CODE !== undefined && r.STAT_HBKEL_CODE !== null ? String(r.STAT_HBKEL_CODE) : null,
      namaLgkp: r.NAMA_LGKP,
      tglLhr: r.TGL_LHR,
      namaKecamatan: r.NAMA_KEC ?? null,
      namaKelurahan: r.NAMA_KEL ?? null,
      currentStatusCode: r.CURRENT_STATUS_CODE ?? null,
      flagStatus: r.FLAG_STATUS ?? null,
      deletedBy: null,
    };
  });
}

async function fetchPersonDemographics(nik: string): Promise<RestorePerson | null> {
  try {
    const rows = await execRows(SQL_PERSON_DEMOGRAPHICS, { b_nik: nik }, {}, DEMOGRAPHICS_DB_ALIAS);
    if (!rows.length) return null;
    const r = rows[0] as any;

    const person: RestorePerson = {
      nik: r.NIK ?? nik,
      noKk: r.NO_KK ?? "-",
      namaLgkp: r.NAMA_LGKP ?? nik,
      tmptLhr: r.TMPT_LHR ?? null,
      tglLhr: r.TGL_LHR ?? null,
      noKec: toNumberOrNull(r.NO_KEC),
      noKel: toNumberOrNull(r.NO_KEL),
      aktaLhr: r.AKTA_LHR !== undefined && r.AKTA_LHR !== null ? String(r.AKTA_LHR) : null,
      noAktaLhr: r.NO_AKTA_LHR ?? null,
      namaIbu: r.NAMA_LGKP_IBU ?? null,
      namaAyah: r.NAMA_LGKP_AYAH ?? null,
      flagStatus: normalizeFlag(r.FLAG_STATUS),
      namaKec: r.NAMA_KEC ?? null,
      namaKel: r.NAMA_KEL ?? null,
      alamat: r.ALAMAT ?? null,
      rt: formatRwRt(r.NO_RT),
      rw: formatRwRt(r.NO_RW),
      namaKep: r.NAMA_KEP ?? null,
      statHubkel: r.STAT_HUBKEL ?? null,
      jenisKelamin: normalizeJenisKelamin(r.JENIS_KLMIN),
      currentStatusCode: r.CURRENT_STATUS_CODE ?? null,
      ket: "DATA DEMOGRAPHICS",
      path: "-",
      photoSource: undefined,
      faceBase64: null,
      faceMime: null,
      alasan: null,
      descAlasan: null,
      deletedBy: null,
      deletedAt: null,
    };

    const face = await fetchFaceFromDb5Direct(person.nik);
    if (face) {
      person.photoSource = "FACES";
      person.faceBase64 = face.base64;
      person.faceMime = face.mime;
    } else {
      person.photoSource = "PLACEHOLDER";
    }

    return person;
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "RESTORE.BIO.WNI DEMOGRAPHICS FETCH FAILED",
      at: AT,
      user: "SYSTEM",
      tookMs: 0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
      extra: { nik, alias: DEMOGRAPHICS_DB_ALIAS },
    });
    return null;
  }
}

async function fetchPersonActive(nik: string, noKec: number | null): Promise<RestorePerson | null> {
  const sql = SQL_PERSON_ACTIVE(Boolean(noKec));
  const binds: Record<string, unknown> = { b_nik: nik };
  if (noKec) binds.b_no_kec = noKec;
  const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
  if (!rows.length) return null;
  const r = rows[0] as any;

  const person: RestorePerson = {
    nik: r.NIK,
    noKk: r.NO_KK,
    namaLgkp: r.NAMA_LGKP,
    tmptLhr: r.TMPT_LHR,
    tglLhr: r.TGL_LHR,
    noKec: r.NO_KEC ?? null,
    noKel: r.NO_KEL ?? null,
    aktaLhr: r.AKTA_LHR,
    noAktaLhr: r.NO_AKTA_LHR,
    namaIbu: r.NAMA_LGKP_IBU,
    namaAyah: r.NAMA_LGKP_AYAH,
    flagStatus: r.FLAG_STATUS,
    namaKec: r.NAMA_KEC,
    namaKel: r.NAMA_KEL,
    alamat: r.ALAMAT,
    rt: r.RT,
    rw: r.RW,
    namaKep: r.NAMA_KEP,
    statHubkel: r.STAT_HBKEL,
    jenisKelamin: r.JENIS_KLMIN,
    currentStatusCode: r.CURRENT_STATUS_CODE,
    ket: r.KET,
    path: r.PATH,
  };

  const face = await fetchFaceFromDb5Direct(person.nik);

  if (!person.path || person.path === "-") {
    if (face) {
      person.photoSource = "FACES";
      person.faceBase64 = face.base64;
      person.faceMime = face.mime;
    } else {
      person.photoSource = "PLACEHOLDER";
    }
  } else {
    person.photoSource = "T5_FOTO";
    if (face) {
      // kirim juga buat fallback UI
      person.faceBase64 = face.base64;
      person.faceMime = face.mime;
    }
  }

  return person;
}

async function fetchPersonDeleted(nik: string, noKec: number | null): Promise<RestorePerson | null> {
  const sql = SQL_PERSON_DELETE(Boolean(noKec));
  const binds: Record<string, unknown> = { b_nik: nik };
  if (noKec) binds.b_no_kec = noKec;
  const rows = await execRows(sql, binds, {}, ORACLE_ALIAS);
  if (!rows.length) return null;
  const r = rows[0] as any;

  const person: RestorePerson = {
    nik: r.NIK,
    noKk: r.NO_KK,
    namaLgkp: r.NAMA_LGKP,
    tmptLhr: r.TMPT_LHR,
    tglLhr: r.TGL_LHR,
    noKec: r.NO_KEC ?? null,
    noKel: r.NO_KEL ?? null,
    aktaLhr: r.AKTA_LHR,
    noAktaLhr: r.NO_AKTA_LHR,
    namaIbu: r.NAMA_LGKP_IBU,
    namaAyah: r.NAMA_LGKP_AYAH,
    flagStatus: r.FLAG_STATUS,
    namaKec: r.NAMA_KEC,
    namaKel: r.NAMA_KEL,
    alamat: r.ALAMAT,
    rt: r.RT,
    rw: r.RW,
    namaKep: r.NAMA_KEP,
    statHubkel: r.STAT_HBKEL,
    jenisKelamin: r.JENIS_KLMIN,
    currentStatusCode: r.CURRENT_STATUS_CODE,
    ket: r.KET,
    path: r.PATH,
    alasan: r.ALASAN,
    descAlasan: r.DESC_ALASAN,
    deletedBy: r.CREATED_BY,
    deletedAt: r.DELETE_DT,
  };

  const face = await fetchFaceFromDb5Direct(person.nik);

  if (!person.path || person.path === "-") {
    if (face) {
      person.photoSource = "FACES";
      person.faceBase64 = face.base64;
      person.faceMime = face.mime;
    } else {
      person.photoSource = "PLACEHOLDER";
    }
  } else {
    person.photoSource = "T5_FOTO";
    if (face) {
      person.faceBase64 = face.base64;
      person.faceMime = face.mime;
    }
  }

  return person;
}

async function fetchFamilyByNik(nik: string): Promise<RestoreFamily[]> {
  const rows = await execRows(SQL_FAMILY_BY_NIK, { b_nik: nik }, {}, ORACLE_ALIAS);
  return rows.map((row) => {
    const r = row as Record<string, any>;
    return {
      nik: r.NIK,
      noKk: r.NO_KK,
      statHubkel: r.STAT_HUBKEL,
      statHbkel: r.STAT_HBKEL,
      namaLgkp: r.NAMA_LGKP,
      tglLhr: r.TGL_LHR,
      namaKecamatan: r.NAMA_KECAMATAN,
      namaKelurahan: r.NAMA_KELURAHAN,
      currentStatusCode: r.CURRENT_STATUS_CODE,
      flagStatus: r.FLAG_STATUS,
      deletedBy: r.DELETED_BY,
    };
  });
}

async function fetchFamilyByNoKk(noKk: string): Promise<RestoreFamily[]> {
  const rows = await execRows(SQL_FAMILY_BY_NOKK, { b_no_kk: noKk }, {}, ORACLE_ALIAS);
  return rows.map((row) => {
    const r = row as Record<string, any>;
    return {
      nik: r.NIK,
      noKk: r.NO_KK,
      statHubkel: r.STAT_HUBKEL,
      statHbkel: r.STAT_HBKEL,
      namaLgkp: r.NAMA_LGKP,
      tglLhr: r.TGL_LHR,
      namaKecamatan: r.NAMA_KECAMATAN ?? null,
      namaKelurahan: r.NAMA_KELURAHAN ?? null,
      currentStatusCode: r.CURRENT_STATUS_CODE,
      flagStatus: r.FLAG_STATUS,
      deletedBy: r.DELETED_BY,
    };
  });
}

async function fetchHistoryPindah(nik: string): Promise<PindahHistory | null> {
  const rows = await execRows(SQL_HISTORY_PINDAH, { b_nik: nik }, {}, ORACLE_ALIAS);
  if (!rows.length) return null;
  const r = rows[0] as Record<string, any>;
  return {
    noPindah: r.NO_PINDAH ?? null,
    klasifikasiPindah: r.KLASIFIKASI_PINDAH ?? null,
    dari: {
      provinsi: r.DARI_NAMA_PROVINSI ?? null,
      kabupaten: r.DARI_NAMA_KABUPATEN ?? null,
      kecamatan: r.DARI_NAMA_KECAMATAN ?? null,
      kelurahan: r.DARI_NAMA_KELURAHAN ?? null,
    },
    tujuan: {
      provinsi: r.TUJUAN_NAMA_PROVINSI ?? null,
      kabupaten: r.TUJUAN_NAMA_KABUPATEN ?? null,
      kecamatan: r.TUJUAN_NAMA_KECAMATAN ?? null,
      kelurahan: r.TUJUAN_NAMA_KELURAHAN ?? null,
    },
    tanggal: r.CREATED_DATE ?? null,
  };
}

async function fetchHistoryKematian(nik: string): Promise<string | null> {
  const rows = await execRows(SQL_HISTORY_KEMATIAN, { b_nik: nik }, {}, ORACLE_ALIAS);
  if (!rows.length) return null;
  const r = rows[0] as Record<string, any>;
  return r.KET ?? null;
}

/* =========================================================
   ROUTE
   ========================================================= */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) {
    return unauthorized("Sesi tidak ditemukan");
  }

  let payload: RestorePayload;
  try {
    payload = (await req.json()) as RestorePayload;
  } catch {
    return badRequest("Payload harus berupa JSON");
  }

  const nik = normalizeDigits(payload?.nik);
  const noKk = normalizeDigits(payload?.noKk);
  const noKec = normalizeKecamatan(payload?.noKec);

  if (!nik && !noKk) {
    return badRequest("Isi salah satu NIK atau No KK");
  }
  if (nik && nik.length !== 16) {
    return badRequest("NIK harus terdiri dari 16 digit");
  }
  if (noKk && noKk.length !== 16) {
    return badRequest("No KK harus terdiri dari 16 digit");
  }

  try {
    let response: RestoreResponse = {
      source: "NONE",
      person: null,
      family: [],
      historyPindah: null,
      historyKematian: null,
    };

    if (nik) {
      const activeExists = await hasActiveRecord(nik, noKec);
      if (activeExists) {
        const person = await fetchPersonActive(nik, noKec);
        const family = await fetchFamilyByNik(nik);
        response = {
          source: "ACTIVE",
          person,
          family,
          historyPindah: await fetchHistoryPindah(nik),
          historyKematian: await fetchHistoryKematian(nik),
        };
      } else {
        const deletedExists = await hasDeletedRecord(nik, noKec);
        if (deletedExists) {
          const person = await fetchPersonDeleted(nik, noKec);
          const family = person?.noKk
            ? await fetchFamilyByNoKk(person.noKk)
            : await fetchFamilyByNik(nik);
          response = {
            source: "DELETED",
            person,
            family,
            historyPindah: await fetchHistoryPindah(nik),
            historyKematian: await fetchHistoryKematian(nik),
          };
        } else {
          const archivePerson = await fetchPersonDemographics(nik);
          if (archivePerson) {
            const family =
              archivePerson.noKk && archivePerson.noKk !== "-" && archivePerson.noKk !== ""
                ? await fetchFamilyDemographicsByNoKk(archivePerson.noKk)
                : await fetchFamilyDemographicsByNik(nik);
            response = {
              source: "ARCHIVE",
              person: archivePerson,
              family,
              historyPindah: await fetchHistoryPindah(nik),
              historyKematian: await fetchHistoryKematian(nik),
            };
          } else {
            let family = noKk ? await fetchFamilyByNoKk(noKk) : await fetchFamilyByNik(nik);
            if (!family.length) {
              family = noKk
                ? await fetchFamilyDemographicsByNoKk(noKk)
                : await fetchFamilyDemographicsByNik(nik);
            }
            response = {
              source: family.length ? "FAMILY_ONLY" : "NONE",
              person: null,
              family,
              historyPindah: await fetchHistoryPindah(nik),
              historyKematian: await fetchHistoryKematian(nik),
            };
          }
        }
      }
    } else if (noKk) {
      let family = await fetchFamilyByNoKk(noKk);
      if (!family.length) {
        family = await fetchFamilyDemographicsByNoKk(noKk);
      }
      response = {
        source: family.length ? "FAMILY_ONLY" : "NONE",
        person: null,
        family,
        historyPindah: null,
        historyKematian: null,
      };
    }

    await Log.info({
      scope: "API",
      msg: "RESTORE.BIO.WNI",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      extra: {
        nik: nik || undefined,
        noKk: noKk || undefined,
        source: response.source,
        familyCount: response.family.length,
      },
    });

    return ok(response);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "RESTORE.BIO.WNI FAILED",
      at: AT,
      user: session.S_USER_ID,
      tookMs: Date.now() - startedAt,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: {
        nik: nik || undefined,
        noKk: noKk || undefined,
      },
    });
    return err("Gagal memproses permintaan Restore Biodata WNI");
  }
}
