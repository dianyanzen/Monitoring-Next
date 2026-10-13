import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { readServerSession, getClientInfo } from "@/lib/session";
import { execDml } from "@/lib/db";
import { Log } from "@/lib/log";
import { buildInClause, resolveNoKec, resolveReason, sanitizeNikList } from "../utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_EKTP_PERUBAHAN ?? process.env.DB_ALIAS_PRR ?? "DB222";

type Body = {
  nik?: string;
  niks?: string;
  nikList?: string[];
  reqstatus?: number;
};

function parseNikPayload(body: Body) {
  if (Array.isArray(body.nikList)) {
    return sanitizeNikList(body.nikList.join(","));
  }
  if (typeof body.nik === "string" && body.nik.trim()) {
    return sanitizeNikList(body.nik);
  }
  if (typeof body.niks === "string" && body.niks.trim()) {
    return sanitizeNikList(body.niks);
  }
  return [];
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid");

    const body = (await req.json().catch(() => ({}))) as Body;
    const nikList = parseNikPayload(body);
    if (nikList.length === 0) {
      return badRequest("NIK wajib diisi (pisah koma jika lebih dari satu)");
    }

    const { clause, binds: nikBinds } = buildInClause(nikList);
    const noKec = resolveNoKec(session);
    const reason = resolveReason(body.reqstatus ?? 1);

    const sql = `
      INSERT INTO SIAK_REQ_CETAK_KTP (
        NIK, NO_KK, NAMA_LENGKAP, TGL_LAHIR, TMP_LAHIR, NO_PROP, NO_KAB, NO_KEC, NO_KEL,
        REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC, SMS_COUNT, ALAMAT, NO_RT, NO_RW, DUSUN,
        TELP, KODE_POS, JENIS_KLMIN, ID_CETAK, SMS_PHONE, ALASAN_PENGAJUAN
      )
      SELECT
        B.NIK,
        B.NO_KK,
        B.NAMA_LGKP AS NAMA_LENGKAP,
        B.TGL_LHR AS TGL_LAHIR,
        B.TMPT_LHR AS TMP_LAHIR,
        B.NO_PROP,
        B.NO_KAB,
        CASE WHEN :b_no_kec IS NULL OR :b_no_kec = 0 THEN B.NO_KEC ELSE :b_no_kec END AS NO_KEC,
        B.NO_KEL,
        SYSDATE AS REQ_DATE,
        :b_req_by AS REQ_BY,
        NULL AS PROC_DATE,
        NULL AS PROC_BY,
        'A' AS STEP_PROC,
        0 AS SMS_COUNT,
        B.ALAMAT,
        B.NO_RT,
        B.NO_RW,
        B.DUSUN,
        NULL AS TELP,
        B.KODE_POS,
        CASE WHEN B.JENIS_KLMIN = 'LAKI-LAKI' THEN 1 ELSE 0 END AS JENIS_KLMIN,
        CONCAT(CONCAT(CONCAT(TRUNC(DBMS_RANDOM.VALUE(1000000000,9999999999)),'-'),TRUNC(DBMS_RANDOM.VALUE(1000000000,9999999999))),B.NIK) AS ID_CETAK,
        NULL AS SMS_PHONE,
        :b_reason AS ALASAN_PENGAJUAN
      FROM DEMOGRAPHICS_ALL B
      WHERE B.NIK IN (${clause})
        AND NOT EXISTS (SELECT 1 FROM SIAK_REQ_CETAK_KTP D WHERE B.NIK = D.NIK AND D.STEP_PROC = 'A')
    `;

    const rows = await execDml(
      sql,
      {
        b_no_kec: noKec ?? 0,
        b_req_by: session.S_USER_ID,
        b_reason: reason,
        ...nikBinds,
      },
      {},
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "req_ektp_perubahan/ajukan",
      at: "/api/req/ektp/perubahan/ajukan",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { inserted: rows, nikCount: nikList.length, reason },
    });

    return ok({ inserted: rows, requested: nikList.length }, "Pengajuan perubahan berhasil dikirim");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "req_ektp_perubahan/ajukan_err",
      at: "/api/req/ektp/perubahan/ajukan",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal mengajukan pencetakan eKTP (perubahan)");
  }
}
