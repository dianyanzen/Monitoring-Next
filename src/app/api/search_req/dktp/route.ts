import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { buildInClause, sanitizeNikList } from "@/app/api/req/ektp/perubahan/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK ?? process.env.DB_ALIAS_PRR ?? "DB5CETAK";

const todayDMY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

function normalizeDMY(input: string | undefined | null) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${d}-${m}-${y}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const noKec = Number(body.no_kec ?? 0) || 0;
    const noKel = Number(body.no_kel ?? 0) || 0;
    const nikRaw = (body.nikList ?? body.nik ?? body.niks ?? "") as string;
    const nikList = sanitizeNikList(nikRaw);

    const start = normalizeDMY(body.tgl_start ?? body.start) ?? todayDMY();
    const end = normalizeDMY(body.tgl_end ?? body.end) ?? start;

    const where: string[] = [
      "(A.REQ_DATE < C.PERSONALIZED_DATE)",
      "A.REQ_DATE >= TO_DATE(:b_start,'DD-MM-YYYY')",
      "A.REQ_DATE < TO_DATE(:b_end,'DD-MM-YYYY') + 1",
    ];
    const binds: Record<string, any> = { b_start: start, b_end: end };

    if (noKec) {
      where.push("X.NO_KEC = :b_no_kec");
      binds.b_no_kec = noKec;
    }
    if (noKel) {
      where.push("X.NO_KEL = :b_no_kel");
      binds.b_no_kel = noKel;
    }
    if (nikList.length) {
      const { clause, binds: nikBinds } = buildInClause(nikList, "nik");
      where.push(`X.NIK IN (${clause})`);
      Object.assign(binds, nikBinds);
    }

    const SQL = `
      SELECT
        X.NO_KEC,
        X.NIK,
        X.NAMA_LGKP AS NAMA_LENGKAP,
        X.ALAMAT,
        CASE
          WHEN A.ALASAN_PENGAJUAN IS NOT NULL THEN A.ALASAN_PENGAJUAN
          WHEN A.STEP_PROC = 'T' THEN UPPER(A.PROC_BY)
          WHEN A.STEP_PROC = 'C' THEN 'SUDAH DICATAK'
          ELSE '-'
        END AS KETERANGAN_STATUS,
        CASE WHEN TO_CHAR(X.KODE_POS) IS NULL THEN '-' ELSE TO_CHAR(X.KODE_POS) END AS KODE_POS,
        LPAD(TO_CHAR(X.NO_RT), 3, '0') AS RT,
        LPAD(TO_CHAR(X.NO_RW), 3, '0') AS RW,
        X.CURRENT_STATUS_CODE,
        TO_CHAR(A.REQ_DATE,'DD-MM-YYYY') AS REQ_DATE,
        A.REQ_BY,
        TO_CHAR(C.PERSONALIZED_DATE,'DD-MM-YYYY') AS PRINTED_DATE,
        CASE
          WHEN TO_CHAR(C.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(C.CREATED_USERNAME) IS NULL THEN '-'
          WHEN TO_CHAR(C.LAST_UPDATED_USERNAME) IS NULL AND TO_CHAR(C.CREATED_USERNAME) IS NOT NULL THEN TO_CHAR(C.CREATED_USERNAME)
          ELSE TO_CHAR(C.LAST_UPDATED_USERNAME)
        END AS PRINTED_BY,
        X.NAMA_KEC,
        X.NAMA_KEL,
        X.AGAMA,
        X.JENIS_PKRJN,
        X.STAT_KWN
      FROM DEMOGRAPHICS_ALL@DB5CETAK X
      INNER JOIN (
        SELECT ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC, PROC_BY, ALASAN_PENGAJUAN FROM (
          SELECT ID_CETAK, NO_KEC, NO_KEL, NIK, NAMA_LENGKAP, REQ_DATE, REQ_BY, STEP_PROC, PROC_BY, ALASAN_PENGAJUAN,
                 RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE DESC, ID_CETAK DESC) RNK
          FROM SIAK_REQ_CETAK_KTP@YZDB
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
      ORDER BY A.REQ_DATE DESC, X.NIK
    `;

    const rows = await execRows(SQL, binds, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "search_req/dktp",
      at: "/api/search_req/dktp",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: rows.length, noKec, noKel, start, end, nikCount: nikList.length },
    });

    return ok({ items: rows, count: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "search_req/dktp_err",
      at: "/api/search_req/dktp",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data", 500);
  }
}
