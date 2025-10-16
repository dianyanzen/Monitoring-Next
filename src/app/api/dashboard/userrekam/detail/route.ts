// FILE: src/app/api/dashboard/userrekam/detail/route.ts
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
					'-' CHIP_ID
					, B.NIK
					, B.NAMA_LGKP NAMA_LENGKAP 
					, B.CURRENT_STATUS_CODE
					, TO_CHAR(B.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR
					, TRUNC(MONTHS_BETWEEN(SYSDATE,B.TGL_LHR)/12) UMUR
					, B.AGAMA
					, '-' REQ_DATE
					, '-' REQ_BY
					, TO_CHAR(A.CREATED,'DD-MM-YYYY') PRINTED_DATE 
					, TO_CHAR(A.CREATED,'HH24:MI') PRINTED_HR
					, A.CREATED_USERNAME PRINTED_BY 
					, B.NAMA_KEC
					, B.NAMA_KEL
					, B.ALAMAT
					, LPAD(TO_CHAR(B.NO_RT), 3, '0') AS RT
					, LPAD(TO_CHAR(B.NO_RW), 3, '0') AS RW
					, CASE WHEN B.KODE_POS IS NULL THEN '-' ELSE TO_CHAR(B.KODE_POS) END KODE_POS
					, B.STAT_KWN
					, B.JENIS_PKRJN
					FROM DEMOGRAPHICS B INNER JOIN FINGERS A ON A.NIK = B.NIK
					WHERE 
--                    TRUNC(A.CREATED) =  TRUNC(TO_DATE('$tanggal','DD-MM-YYYY')) 
                    TRUNC(A.CREATED) >= TO_DATE(:b_start,'DD-MM-YYYY') AND  TRUNC(A.CREATED) < TO_DATE(:b_end,'DD-MM-YYYY') +1
					AND  UPPER(TO_CHAR(A.CREATED_USERNAME))  LIKE UPPER(:p_user)
					ORDER BY TO_CHAR(B.CREATED,'HH24:MI')
  `;

  try {
    const binds = { p_user, p_start, p_end };
    const rows = await execRows(sql, binds, {}, "DB5");
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
