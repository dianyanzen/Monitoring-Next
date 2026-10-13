import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { buildInClause, sanitizeNikList } from "@/app/api/req/ektp/perubahan/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK ?? process.env.DB_ALIAS_PRR ?? "DB5CETAK";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const nikRaw = (body.nikList ?? body.nik ?? body.niks ?? "") as string;
    const nikList = sanitizeNikList(nikRaw).slice(0, 1000);
    if (!nikList.length) return badRequest("NIK wajib diisi.");

    const noKec = Number(session.S_NO_KEC ?? 0) || 0;

    const { clause, binds: nikBinds } = buildInClause(nikList, "nik");

    const where: string[] = [
      `X.NIK IN (${clause})`,
      "(TRUNC(A.REQ_DATE) + 1 > TRUNC(C.PERSONALIZED_DATE) OR C.PERSONALIZED_DATE IS NULL)",
    ];
    const binds: Record<string, any> = { ...nikBinds };
    if (noKec) {
      where.push("A.NO_KEC = :b_no_kec");
      binds.b_no_kec = noKec;
    }

    const SQL = `
      SELECT 
        A.NO_KEC,
        X.NIK,
        X.NAMA_LGKP AS NAMA_LENGKAP,
        X.ALAMAT,
        CASE WHEN TO_CHAR(X.KODE_POS) IS NULL THEN '-' ELSE TO_CHAR(X.KODE_POS) END AS KODE_POS,
        LPAD(TO_CHAR(X.NO_RT), 3, '0') AS RT,
        LPAD(TO_CHAR(X.NO_RW), 3, '0') AS RW,
        CASE WHEN X.CURRENT_STATUS_CODE IS NULL THEN '-' ELSE X.CURRENT_STATUS_CODE END AS CURRENT_STATUS_CODE,
        TO_CHAR(A.REQ_DATE,'YYYY-MM-DD') AS REQ_DATE,
        A.REQ_BY,
        CASE WHEN A.STEP_PROC = 'T' THEN 'DITOLAK' WHEN A.STEP_PROC = 'C' THEN 'DICETAK' ELSE 'PROSSESS' END AS STATUS_PENGAJUAN,
        CASE WHEN A.STEP_PROC = 'T' THEN UPPER(A.PROC_BY) WHEN A.STEP_PROC = 'C' THEN 'SUDAH DICATAK' ELSE '-' END AS KETERANGAN_STATUS,
        TO_CHAR(C.PERSONALIZED_DATE,'YYYY-MM-DD') AS PRINTED_DATE,
        CASE
          WHEN TO_CHAR(C.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(C.CREATED_USERNAME) IS NULL THEN '-'
          WHEN TO_CHAR(C.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(C.CREATED_USERNAME) IS NOT NULL THEN TO_CHAR(C.CREATED_USERNAME)
          ELSE TO_CHAR(C.LAST_UPDATED_USERNAME)
        END AS PRINTED_BY,
        X.NAMA_KEC,
        X.NAMA_KEL,
        X.JENIS_PKRJN,
        X.STAT_KWN
      FROM DEMOGRAPHICS_ALL@DB5CETAK X
      INNER JOIN (
        SELECT ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC, PROC_BY FROM (
          SELECT ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC, PROC_BY,
                 RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
          FROM SIAK_REQ_CETAK_KTP@YZDB
          WHERE STEP_PROC <> 'C'
        ) WHERE RNK = 1
      ) A ON A.NIK = X.NIK
      LEFT JOIN (
        SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME FROM (
          SELECT NIK, PERSONALIZED_DATE, CREATED_USERNAME, LAST_UPDATED_USERNAME,
                 RANK() OVER (PARTITION BY NIK ORDER BY PERSONALIZED_DATE DESC, LAST_UPDATE DESC, CHIP_ID DESC) RNK
          FROM CARD_MANAGEMENT@DB5CETAK
        ) WHERE RNK = 1
      ) C ON A.NIK = C.NIK
      WHERE ${where.join(" AND ")}
      ORDER BY C.PERSONALIZED_DATE, A.REQ_DATE DESC, X.NIK
    `;

    const rows = await execRows(SQL, binds, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "search_req/delete_req",
      at: "/api/search_req/delete_req",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: rows.length, noKec, nikCount: nikList.length },
    });

    return ok({ items: rows, count: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "search_req/delete_req_err",
      at: "/api/search_req/delete_req",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat data", 500);
  }
}
