// FILE: src/app/api/check/failure/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

const ORACLE_ALIAS = process.env.DB_ALIAS_PRR ?? "DB5CETAK";

/** keep only primitive for response safety */
function toPlain(obj: any) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map((x) => toPlain(x));
  if (typeof obj === "object") {
    const p: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) p[k] = v;
      else if (["string", "number", "boolean"].includes(typeof v)) p[k] = v;
    }
    return p;
  }
  return obj;
}

/** SQL utama: FAILURE = PEREKAMAN_INVALID belum ada di CARD_MANAGEMENT */
const SQL_FAILURE = `
  SELECT
    TO_CHAR(A.NIK) AS NIK,
    A.NAMA_LGKP,
    A.TMPT_LHR,
    TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
    TRUNC(MONTHS_BETWEEN(SYSDATE, A.TGL_LHR)/12) AS UMUR,
    NVL(A.ALAMAT,'-') AS ALAMAT,
    A.NO_KEC,  A.NAMA_KEC,
    A.NO_KEL,  A.NAMA_KEL,
    NVL(A.NO_RW,0) AS NO_RW,
    NVL(A.NO_RT,0) AS NO_RT,
    NVL(TO_CHAR(A.KODE_POS),'-') AS KODE_POS,
    A.AGAMA,
    A.STAT_KWN AS STATUS_KAWIN,
    A.JENIS_PKRJN AS PEKERJAAN,
    A.GOL_DRH,
    TO_CHAR(A.CREATED,'YYYY-MM-DD') AS TGL_REKAM,
    A.CURRENT_STATUS_CODE AS STATUS_KTP,
    A.CREATED_USERNAME AS PETUGAS_REKAM
  FROM DEMOGRAPHICS@DB5 A
  LEFT JOIN CARD_MANAGEMENT D ON A.NIK = D.NIK
  WHERE A.CURRENT_STATUS_CODE NOT LIKE '%CARD%' 
  AND A.CURRENT_STATUS_CODE NOT LIKE '%PRINT%' 
  AND  A.CURRENT_STATUS_CODE NOT LIKE '%DUPLICATE%' 
  AND A.CURRENT_STATUS_CODE NOT LIKE 'SENT_FOR_ENROLLMENT'
    AND D.NIK IS NULL
    AND (A.TGL_LHR <= ADD_MONTHS(SYSDATE, -12*17) OR NVL(A.STAT_KWN,'BELUM KAWIN') <> 'BELUM KAWIN')
    AND (:b_forced_no_kec = 0 OR A.NO_KEC = :b_forced_no_kec) -- paksa scope user bila ada
    AND (:b_no_kec = 0 OR A.NO_KEC = :b_no_kec)
    AND (:b_no_kel = 0 OR A.NO_KEL = :b_no_kel)
  ORDER BY A.CREATED, A.NO_KEL, A.NO_RW, A.NO_RT
`;

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = await req.json().catch(() => ({} as any));
    const input_no_kec = Number(body?.no_kec ?? 0) || 0;
    const input_no_kel = Number(body?.no_kel ?? 0) || 0;

    // jika user dibatasi kecamatan, paksa filter
    const forced_no_kec = Number(s.S_NO_KEC ?? 0) || 0;

    const binds = {
      b_forced_no_kec: forced_no_kec,
      b_no_kec: input_no_kec,
      b_no_kel: input_no_kel,
    };

    const raw = await execRows(SQL_FAILURE, binds, {}, ORACLE_ALIAS);
    const rows = Array.isArray(raw) ? toPlain(raw) : [];

    await Log.info({
      scope: "API",
      msg: "failure served",
      at: "/api/check/failure",
      tookMs: Date.now() - t0,
      extra: {
        total: rows.length,
        forced_no_kec: forced_no_kec,
        no_kec: input_no_kec,
        no_kel: input_no_kel,
      },
    });

    // kalau ingin micro-cache: return ok({ rows, total: rows.length }, 15)
    return ok({ rows, total: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "failure error",
      at: "/api/check/failure",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data", 500);
  }
}
