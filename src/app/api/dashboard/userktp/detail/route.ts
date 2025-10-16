// FILE: src/app/api/dashboard/userktp/detail/route.ts
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);
  const p_user  = url.searchParams.get("user")  || "";          // ⬅️ rename bind
  const p_start = url.searchParams.get("start") || new Date().toISOString().slice(0,10);
  const p_end   = url.searchParams.get("end")   || p_start;

  const sql = `
    SELECT 
      A.CHIP_ID,
      A.NIK,
      B.NAMA_LGKP AS NAMA_LENGKAP,
      B.CURRENT_STATUS_CODE,
      TO_CHAR(B.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
      TRUNC(MONTHS_BETWEEN(SYSDATE,B.TGL_LHR)/12) AS UMUR,
      B.AGAMA,
      NVL(TO_CHAR(H.REQ_DATE,'DD-MM-YYYY'), '-') AS REQ_DATE,
      NVL(H.REQ_BY, '-') AS REQ_BY,
      NVL(TO_CHAR(A.LAST_UPDATE,'DD-MM-YYYY'), TO_CHAR(A.PERSONALIZED_DATE,'DD-MM-YYYY')) AS PRINTED_DATE,
      NVL(TO_CHAR(A.LAST_UPDATE,'HH24:MI'), TO_CHAR(A.PERSONALIZED_DATE,'HH24:MI')) AS PRINTED_HR,
      NVL(A.LAST_UPDATED_USERNAME, A.CREATED_USERNAME) AS PRINTED_BY,
      B.NAMA_KEC,
      B.NAMA_KEL,
      B.ALAMAT,
      LPAD(TO_CHAR(B.NO_RT), 3, '0') AS RT,
      LPAD(TO_CHAR(B.NO_RW), 3, '0') AS RW,
      NVL(TO_CHAR(B.KODE_POS), '-') AS KODE_POS,
      B.STAT_KWN,
      B.JENIS_PKRJN
    FROM CARD_MANAGEMENT A
    LEFT JOIN DEMOGRAPHICS B ON A.NIK = B.NIK
    LEFT JOIN (
      SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC
      FROM (
        SELECT NIK, REQ_DATE, REQ_BY, PROC_DATE, PROC_BY, STEP_PROC,
               RANK() OVER (PARTITION BY NIK ORDER BY REQ_DATE, ID_CETAK DESC) RNK
        FROM SIAK_REQ_CETAK_KTP@YZDB
      ) WHERE RNK = 1
    ) H ON A.NIK = H.NIK
    WHERE TRUNC(NVL(A.LAST_UPDATE, A.PERSONALIZED_DATE))
          BETWEEN TO_DATE(:p_start,'YYYY-MM-DD') AND TO_DATE(:p_end,'YYYY-MM-DD')
      AND (
        :p_user = '' OR
        UPPER(NVL(A.LAST_UPDATED_USERNAME, A.CREATED_USERNAME)) LIKE '%' || UPPER(:p_user) || '%'
      )
    ORDER BY NVL(TO_CHAR(A.LAST_UPDATE,'HH24:MI'), TO_CHAR(A.PERSONALIZED_DATE,'HH24:MI'))
  `;

  try {
    const binds = { p_user, p_start, p_end };
    const rows = await execRows(sql, binds, {}, "DB5CETAK");
    await Log.info({
      scope: "API",
      msg: "detail served",
      at: "/api/dashboard/userktp/detail",
      tookMs: Date.now()-t0,
      extra:{ rowCount: rows.length },
      binds
    });
    return ok({ data: rows });
  } catch (e:any) {
    await Log.error({
      scope:"API",
      msg:"detail error",
      at:"/api/dashboard/userktp/detail",
      tookMs: Date.now()-t0,
      err:{ name:e?.name||"Error", message:e?.message||String(e) }
    });
    return err(e?.message ?? "Failed", 500);
  }
}
