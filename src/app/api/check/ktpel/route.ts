import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { readServerSession } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import {
  KtpelRow,
  mapRekamRow,
  mapWktpRow,
  normalizeDateInput,
  normalizeText,
  sanitizeNumberList,
  getSearchAlias,
  getWktpAlias,
} from "./utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SQL_REKAM_BASE = `
  SELECT
    A.NIK,
    A.NO_KK,
    A.NAMA_LGKP,
    A.TMPT_LHR,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    A.JENIS_KLMIN,
    A.ALAMAT,
    LPAD(TO_CHAR(A.NO_RT), 3, '0') AS RT,
    LPAD(TO_CHAR(A.NO_RW), 3, '0') AS RW,
    A.KODE_POS,
    (SELECT COUNT(1) FROM CARD_MANAGEMENT WHERE NIK = A.NIK) AS JUMLAH_CETAK,
    A.NAMA_KEC,
    A.NAMA_KEL,
    A.AGAMA,
    A.JENIS_PKRJN,
    A.STAT_KWN,
    CASE WHEN A.CURRENT_STATUS_CODE IS NULL THEN '-' ELSE A.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    CASE
      WHEN F.DIS_DT IS NULL THEN TO_CHAR(H.DIS_DT,'DD-MM-YYYY')
      WHEN H.DIS_DT > F.DIS_DT THEN TO_CHAR(H.DIS_DT,'DD-MM-YYYY')
      ELSE TO_CHAR(F.DIS_DT,'DD-MM-YYYY')
    END AS DIS_DT,
    CASE
      WHEN F.DIS_BY IS NULL THEN H.DIS_BY
      WHEN H.DIS_DT > F.DIS_DT THEN H.DIS_BY
      ELSE F.DIS_BY
    END AS DIS_BY,
    CASE
      WHEN TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY') IS NULL THEN '-'
      WHEN TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY') IS NOT NULL THEN TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY')
      ELSE TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY')
    END AS KTP_DT,
    CASE
      WHEN TO_CHAR(G.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(G.CREATED_USERNAME) IS NULL THEN '-'
      WHEN TO_CHAR(G.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(G.CREATED_USERNAME) IS NOT NULL THEN TO_CHAR(G.CREATED_USERNAME)
      ELSE TO_CHAR(G.LAST_UPDATED_USERNAME)
    END AS KTP_BY,
    E.PATH,
    CASE
      WHEN TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(I.REQ_DATE,'DD-MM-YYYY') IS NOT NULL THEN TO_CHAR(I.REQ_DATE,'DD-MM-YYYY')
      WHEN TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(I.REQ_DATE,'DD-MM-YYYY') IS NOT NULL THEN '-'
      ELSE TO_CHAR(H.REQ_DATE,'DD-MM-YYYY')
    END AS REQ_DATE,
    CASE
      WHEN H.REQ_BY IS NULL AND I.REQ_BY IS NOT NULL THEN I.REQ_BY
      WHEN I.REQ_BY IS NULL AND H.REQ_BY IS NULL THEN '-'
      ELSE H.REQ_BY
    END AS REQ_BY,
    CASE
      WHEN H.ALASAN_PENGAJUAN IS NULL AND I.NIK IS NOT NULL THEN 'PINDAHAN'
      WHEN H.ALASAN_PENGAJUAN IS NULL AND I.NIK IS NULL THEN '-'
      ELSE H.ALASAN_PENGAJUAN
    END AS PROC_BY,
    CASE
      WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL AND I.STEP_PROC = 'A' THEN 'Masih Dalam Proses'
      WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL AND I.STEP_PROC = 'C' THEN 'Sudah Tercetak'
      WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL AND I.STEP_PROC = 'T' THEN 'Pengajuan Ditolak'
      WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NOT NULL THEN 'Lainnya'
      WHEN H.STEP_PROC IS NULL AND I.STEP_PROC IS NULL THEN '-'
      WHEN H.STEP_PROC = 'T' THEN 'Pengajuan Ditolak'
      WHEN H.STEP_PROC = 'A' THEN 'Masih Dalam Proses'
      WHEN H.STEP_PROC = 'C' THEN 'Sudah Tercetak'
      ELSE H.STEP_PROC
    END AS STEP_PROC
  FROM DEMOGRAPHICS_ALL A
  LEFT JOIN T5_FOTO@DB222 E ON A.NIK = E.NIK
  LEFT JOIN (
    SELECT NIK, DIS_BY, DIS_DT FROM (
      SELECT NIK, REQ_BY AS DIS_BY, TGL_CETAK AS DIS_DT,
             RANK() OVER (PARTITION BY NIK ORDER BY TGL_CETAK DESC, NO DESC) RNK
      FROM SIAK_CETAK_DINAS@YZDB
    ) WHERE RNK = 1
  ) F ON A.NIK = F.NIK
  LEFT JOIN (
    SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME, LAST_UPDATE, CREATED
    FROM (
      SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME, LAST_UPDATE, CREATED,
             RANK() OVER (PARTITION BY NIK ORDER BY PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK
      FROM CARD_MANAGEMENT
    ) WHERE RNK = 1
  ) G ON G.NIK = A.NIK
  LEFT JOIN (
    SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, ALASAN_PENGAJUAN, DIS_BY, DIS_DT
    FROM (
      SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, ALASAN_PENGAJUAN, DIS_BY, DIS_DT,
             RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
      FROM SIAK_REQ_CETAK_KTP@YZDB
    ) WHERE RNK = 1
  ) H ON H.NIK = A.NIK
  LEFT JOIN (
    SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, DIS_BY, DIS_DT
    FROM (
      SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, DIS_BY, DIS_DT,
             RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
      FROM SIAK_REQ_CETAK_KTPLD@YZDB
    ) WHERE RNK = 1
  ) I ON I.NIK = A.NIK
  WHERE 1 = 1
`;

const SQL_HIST_BASE = `
  SELECT
    A.NIK,
    A.NO_KK,
    A.NAMA_LGKP,
    A.TMPT_LHR,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    CASE WHEN A.JENIS_KLMIN = 1 THEN 'LAKI-LAKI' WHEN A.JENIS_KLMIN = 2 THEN 'PEREMPUAN' ELSE 'TIDAK DIKETAHUI' END AS JENIS_KLMIN,
    K.ALAMAT,
    LPAD(TO_CHAR(K.NO_RT), 3, '0') AS RT,
    LPAD(TO_CHAR(K.NO_RW), 3, '0') AS RW,
    K.KODE_POS,
    (SELECT COUNT(1) FROM CARD_MANAGEMENT WHERE NIK = A.NIK) AS JUMLAH_CETAK,
    F5_GET_NAMA_KECAMATAN@DB222(32,73,K.NO_KEC) AS NAMA_KEC,
    F5_GET_NAMA_KELURAHAN@DB222(32,73,K.NO_KEC, K.NO_KEL) AS NAMA_KEL,
    B.AGAMA,
    B.JENIS_PKRJN,
    B.STAT_KWN,
    CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN '-' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
    CASE
      WHEN F.DIS_DT IS NULL THEN TO_CHAR(H.DIS_DT,'DD-MM-YYYY')
      WHEN H.DIS_DT > F.DIS_DT THEN TO_CHAR(H.DIS_DT,'DD-MM-YYYY')
      ELSE TO_CHAR(F.DIS_DT,'DD-MM-YYYY')
    END AS DIS_DT,
    CASE
      WHEN F.DIS_BY IS NULL THEN H.DIS_BY
      WHEN H.DIS_DT > F.DIS_DT THEN H.DIS_BY
      ELSE F.DIS_BY
    END AS DIS_BY,
    CASE
      WHEN TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY') IS NULL THEN '-'
      WHEN TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY') IS NOT NULL THEN TO_CHAR(G.PERSONALIZED_DATE,'DD-MM-YYYY')
      ELSE TO_CHAR(G.LAST_UPDATE,'DD-MM-YYYY')
    END AS KTP_DT,
    CASE
      WHEN TO_CHAR(G.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(G.CREATED_USERNAME) IS NULL THEN '-'
      WHEN TO_CHAR(G.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(G.CREATED_USERNAME) IS NOT NULL THEN TO_CHAR(G.CREATED_USERNAME)
      ELSE TO_CHAR(G.LAST_UPDATED_USERNAME)
    END AS KTP_BY,
    E.PATH,
    CASE WHEN TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') IS NULL THEN '-' ELSE TO_CHAR(H.REQ_DATE,'DD-MM-YYYY') END AS REQ_DATE,
    CASE WHEN H.REQ_BY IS NULL THEN '-' ELSE H.REQ_BY END AS REQ_BY,
    CASE WHEN H.ALASAN_PENGAJUAN IS NULL THEN '-' ELSE H.ALASAN_PENGAJUAN END AS PROC_BY,
    CASE
      WHEN H.STEP_PROC IS NULL THEN '-'
      WHEN H.STEP_PROC = 'T' THEN 'Pengajuan Ditolak'
      WHEN H.STEP_PROC = 'A' THEN 'Masih Dalam Proses'
      WHEN H.STEP_PROC = 'C' THEN 'Sudah Tercetak'
      ELSE H.STEP_PROC
    END AS STEP_PROC
  FROM BIODATA_WNI_MASTER@DB222 A
  LEFT JOIN DATA_KELUARGA_MASTER@DB222 K ON A.NO_KK = K.NO_KK
  LEFT JOIN DEMOGRAPHICS_ALL B ON A.NIK = B.NIK
  LEFT JOIN T5_FOTO@DB222 E ON A.NIK = E.NIK
  LEFT JOIN (
    SELECT NIK, DIS_BY, DIS_DT FROM (
      SELECT NIK, REQ_BY AS DIS_BY, TGL_CETAK AS DIS_DT,
             RANK() OVER (PARTITION BY NIK ORDER BY TGL_CETAK DESC, NO DESC) RNK
      FROM SIAK_CETAK_DINAS@YZDB
    ) WHERE RNK = 1
  ) F ON A.NIK = F.NIK
  LEFT JOIN (
    SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME, LAST_UPDATE, CREATED
    FROM (
      SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME, LAST_UPDATE, CREATED,
             RANK() OVER (PARTITION BY NIK ORDER BY PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK
      FROM CARD_MANAGEMENT
    ) WHERE RNK = 1
  ) G ON G.NIK = A.NIK
  LEFT JOIN (
    SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, ALASAN_PENGAJUAN, DIS_BY, DIS_DT
    FROM (
      SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, ALASAN_PENGAJUAN, DIS_BY, DIS_DT,
             RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
      FROM SIAK_REQ_CETAK_KTP@YZDB
    ) WHERE RNK = 1
  ) H ON H.NIK = A.NIK
  WHERE 1 = 1 
`;

const SQL_WKTP_BASE = `
  SELECT
    NO_KK,
    NIK,
    NAMA_LGKP,
    TRUNC(MONTHS_BETWEEN(SYSDATE, TGL_LHR) / 12) AS UMUR,
    ALAMAT,
    NO_RT AS RT,
    NO_RW AS RW,
    NO_PROP,
    NAMA_PROP,
    NO_KAB,
    NAMA_KAB,
    NO_KEC,
    NAMA_KEC,
    NO_KEL,
    NAMA_KEL,
    CASE WHEN KETERANGAN = 1 THEN 'SUDAH REKAM' ELSE 'BELUM REKAM' END AS KETERANGAN,
    KETERANGAN_REKAM AS CURRENT_STATUS_CODE,
    NULL AS PATH,
    NULL AS TMPT_LHR,
    NULL AS TGL_LHR,
    NULL AS KTP_BY,
    NULL AS KTP_DT,
    NULL AS JUMLAH_CETAK,
    NULL AS DIS_BY,
    NULL AS DIS_DT,
    NULL AS REQ_BY,
    NULL AS REQ_DATE,
    NULL AS PROC_BY,
    NULL AS STEP_PROC,
    NULL AS KODE_POS
  FROM WKTP_BLM_REKAM_DAPODIK
  WHERE 1=1
`;

type Mode = "rekam" | "hist" | "wktp";

type SearchRequest = {
  mode?: Mode;
  nik?: string;
  noKk?: string;
  namaLgkp?: string;
  tglLhr?: string;
  noKec?: string;
  noKel?: string;
  noRw?: string;
  noRt?: string;
};

function appendListFilter(where: string[], binds: Record<string, any>, column: string, values: string[], key: string) {
  if (!values.length) return;
  if (values.length === 1) {
    const bindKey = `${key}0`;
    where.push(`${column} = :${bindKey}`);
    binds[bindKey] = values[0];
  } else {
    const placeholders: string[] = [];
    values.forEach((val, idx) => {
      const bindKey = `${key}${idx}`;
      placeholders.push(`:${bindKey}`);
      binds[bindKey] = val;
    });
    where.push(`${column} IN (${placeholders.join(", ")})`);
  }
}

function normalizeWilayahCode(raw?: string | null) {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  return digits || null;
}

function normalizeRwRt(raw?: string | null) {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  return value.replace(/[^\d]/g, "");
}

function ensureLikeWildcards(value: string) {
  if (!value) return value;
  const containsWildcard = value.includes("%") || value.includes("_");
  if (containsWildcard) return value;
  return `%${value}%`;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const session = await readServerSession().catch(() => null);
  if (!session) return unauthorized("Sesi tidak ditemukan");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const ua = req.headers.get("user-agent") || undefined;

  let payload: SearchRequest | null = null;
  try {
    payload = (await req.json()) as SearchRequest;
  } catch {
    return badRequest("Payload tidak valid (harus JSON)");
  }
  if (!payload) return badRequest("Payload tidak boleh kosong");

  const mode: Mode = (payload.mode ?? "rekam").toLowerCase() as Mode;
  if (!["rekam", "hist", "wktp"].includes(mode)) {
    return badRequest("Mode pencarian tidak dikenal");
  }

  const nikList = sanitizeNumberList(payload.nik);
  const kkList = sanitizeNumberList(payload.noKk);
  const nama = normalizeText(payload.namaLgkp);
  const birth = normalizeDateInput(payload.tglLhr);
  if (birth && !/^\d{2}-\d{2}-\d{4}$/.test(birth)) {
    return badRequest("Format tanggal lahir harus DD-MM-YYYY");
  }

  const noKec = normalizeWilayahCode(payload.noKec);
  const noKel = normalizeWilayahCode(payload.noKel);
  const noRw = normalizeRwRt(payload.noRw);
  const noRt = normalizeRwRt(payload.noRt);

  if (mode === "wktp") {
    if (!noKec && !noKel) {
      return badRequest("Pencarian W-KTP minimal memerlukan kecamatan atau kelurahan");
    }
  } else if (!nikList.length && !kkList.length && !nama && !birth) {
    return badRequest("Isi minimal salah satu dari NIK, No KK, Nama atau Tanggal Lahir");
  }

  let sql = "";
  const where: string[] = [];
  const binds: Record<string, any> = {};

  if (mode === "rekam" || mode === "hist") {
    sql = mode === "rekam" ? SQL_REKAM_BASE : SQL_HIST_BASE;
    appendListFilter(where, binds, "A.NIK", nikList, "nik");
    appendListFilter(where, binds, "A.NO_KK", kkList, "kk");
    if (nama) {
      where.push("A.NAMA_LGKP LIKE :nama");
      binds.nama = ensureLikeWildcards(nama);
    }
    if (birth) {
      where.push("TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') = :tgl");
      binds.tgl = birth;
    }
    sql += where.length ? ` AND ${where.join(" AND ")}` : "";
    sql += " ORDER BY A.NO_KK, A.NIK";
  } else {
    sql = SQL_WKTP_BASE;
    if (noKec) {
      where.push("NO_KEC = :no_kec");
      binds.no_kec = noKec;
    }
    if (noKel) {
      where.push("NO_KEL = :no_kel");
      binds.no_kel = noKel;
    }
    if (noRw) {
      where.push("NO_RW = :no_rw");
      binds.no_rw = noRw;
    }
    if (noRt) {
      where.push("NO_RT = :no_rt");
      binds.no_rt = noRt;
    }
    sql += where.length ? ` AND ${where.join(" AND ")}` : "";
    sql += " ORDER BY NO_KEC, NO_KEL, NO_KK, NAMA_LGKP";
  }

  try {
    const rows = await execRows<Record<string, any>>(sql, binds, {}, mode === "wktp" ? getWktpAlias() : getSearchAlias());
    const mapped: KtpelRow[] =
      mode === "wktp"
        ? rows.map((row) => mapWktpRow(row))
        : rows.map((row) => mapRekamRow(row, mode));

    await Log.info({
      scope: "API",
      msg: "KTP-el search",
      at: "/api/check/ktpel",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      extra: {
        mode,
        rowCount: mapped.length,
        filters: {
          nik: nikList.length,
          kk: kkList.length,
          nama: Boolean(nama),
          tglLhr: Boolean(birth),
          noKec: noKec || null,
          noKel: noKel || null,
          noRw: noRw || null,
          noRt: noRt || null,
        },
      },
    });

    return ok({ rows: mapped, total: mapped.length, mode });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "KTP-el search failed",
      at: "/api/check/ktpel",
      tookMs: Date.now() - startedAt,
      user: session.S_USER_ID,
      ip,
      ua,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: { mode },
    });
    return err(e?.message || "Gagal memuat data KTP-el", 500);
  }
}
