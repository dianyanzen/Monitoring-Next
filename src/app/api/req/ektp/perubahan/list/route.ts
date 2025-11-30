import type { NextRequest } from "next/server";
import { ok, err, unauthorized } from "@/lib/http";
import { readServerSession, getClientInfo } from "@/lib/session";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { buildInClause, normalizeRow, sanitizeNikList, STATUS_ALLOWED } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_EKTP_PERUBAHAN ?? process.env.DB_ALIAS_PRR ?? "DB222";

function buildStatusBinds(prefix = "s") {
  const placeholders = STATUS_ALLOWED.map((_, i) => `:${prefix}${i}`).join(",");
  const binds: Record<string, any> = {};
  STATUS_ALLOWED.forEach((val, i) => {
    binds[`${prefix}${i}`] = val;
  });
  return { placeholders, binds };
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const searchParams = new URL(req.url).searchParams;
    const rawNik = searchParams.get("nik") || "";
    const nikList = sanitizeNikList(rawNik);

    // Tanpa NIK, ikuti legacy: kosongkan tabel
    if (nikList.length === 0) {
      return ok({ items: [], count: 0 });
    }

    const { clause, binds: nikBinds } = buildInClause(nikList);
    const { placeholders: statusPlaceholders, binds: statusBinds } = buildStatusBinds();

    const sql = `
      SELECT 
        CASE WHEN A.NIK IS NOT NULL THEN A.NO_KEC ELSE B.NO_KEC END AS NO_KEC,
        B.NIK,
        B.NO_KK,
        B.NAMA_LGKP AS NAMA_LENGKAP,
        B.TMPT_LHR,
        TO_CHAR(B.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
        B.ALAMAT,
        CASE WHEN TO_CHAR(B.KODE_POS) IS NULL THEN '-' ELSE TO_CHAR(B.KODE_POS) END AS KODE_POS,
        LPAD(TO_CHAR(B.NO_RT), 3, '0') AS RT,
        LPAD(TO_CHAR(B.NO_RW), 3, '0') AS RW,
        CASE WHEN B.CURRENT_STATUS_CODE IS NULL THEN 'DATA REKAM KOSONG' ELSE B.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
        CASE WHEN TO_CHAR(A.REQ_DATE,'YYYY-MM-DD') IS NULL THEN '-' ELSE TO_CHAR(A.REQ_DATE,'YYYY-MM-DD') END AS REQ_DATE,
        CASE WHEN A.REQ_BY IS NULL THEN '-' ELSE A.REQ_BY END AS REQ_BY,
        CASE WHEN A.ALASAN_PENGAJUAN IS NULL THEN '-' ELSE A.ALASAN_PENGAJUAN END AS ALASAN_PENGAJUAN,
        CASE WHEN A.STEP_PROC = 'T' THEN 'DITOLAK' WHEN A.STEP_PROC = 'C' THEN 'DICETAK' WHEN A.STEP_PROC IS NULL THEN '-' ELSE 'PROSSESS' END AS STATUS_PENGAJUAN,
        CASE WHEN A.ALASAN_PENGAJUAN IS NOT NULL THEN A.ALASAN_PENGAJUAN WHEN A.STEP_PROC = 'T' THEN UPPER(A.PROC_BY) WHEN A.STEP_PROC = 'C' THEN 'SUDAH DICATAK' ELSE '-' END AS KETERANGAN_STATUS,
        CASE WHEN TO_CHAR(C.LAST_UPDATE,'DD-MM-YYYY') IS NULL AND TO_CHAR(C.PERSONALIZED_DATE,'DD-MM-YYYY') IS NULL THEN '-'
             WHEN TO_CHAR(C.LAST_UPDATE,'DD-MM-YYYY') IS NULL THEN TO_CHAR(C.PERSONALIZED_DATE,'DD-MM-YYYY')
             ELSE TO_CHAR(C.LAST_UPDATE,'DD-MM-YYYY')
        END AS PRINTED_DATE,
        CASE WHEN TO_CHAR(C.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(C.CREATED_USERNAME) IS NULL THEN '-'
             WHEN TO_CHAR(C.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(C.CREATED_USERNAME) IS NOT NULL THEN TO_CHAR(C.CREATED_USERNAME)
             ELSE TO_CHAR(C.LAST_UPDATED_USERNAME)
        END AS PRINTED_BY,
        B.NAMA_KEC,
        B.NAMA_KEL,
        B.AGAMA,
        B.JENIS_PKRJN,
        B.STAT_KWN
      FROM DEMOGRAPHICS_ALL@DB5CETAK B
      LEFT JOIN (
        SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME, LAST_UPDATE
        FROM (
          SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME, LAST_UPDATE,
                 RANK() OVER (PARTITION BY NIK ORDER BY PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) AS RNK
          FROM CARD_MANAGEMENT@DB5CETAK
        ) WHERE RNK = 1
      ) C ON B.NIK = C.NIK
      LEFT JOIN (
        SELECT ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC, PROC_BY, ALASAN_PENGAJUAN
        FROM (
          SELECT ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC, PROC_BY, ALASAN_PENGAJUAN,
                 RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) AS RNK
          FROM SIAK_REQ_CETAK_KTP@YZDB
        ) WHERE RNK = 1
      ) A ON A.NIK = B.NIK
      WHERE 1=1
        AND B.CURRENT_STATUS_CODE NOT IN (${statusPlaceholders})
        AND B.CURRENT_STATUS_CODE IS NOT NULL
        AND B.NIK IN (${clause})
      ORDER BY B.NO_KEC, B.NO_KEL, B.NO_KK, B.NO_RW, B.NO_RT, B.NAMA_LGKP
    `;

    const rows = await execRows(sql, { ...statusBinds, ...nikBinds }, {}, ORACLE_ALIAS);
    const items = rows.map(normalizeRow);

    await Log.info({
      scope: "API",
      msg: "req_ektp_perubahan/list",
      at: "/api/req/ektp/perubahan/list",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: items.length, nikCount: nikList.length },
    });

    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ektp_perubahan/list_err",
      at: "/api/req/ektp/perubahan/list",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat list pengajuan perubahan");
  }
}
