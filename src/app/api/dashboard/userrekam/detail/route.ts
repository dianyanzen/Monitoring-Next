import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isoToDDMMYYYY(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) throw new Error("Invalid ISO date");
  return `${d}-${m}-${y}`;
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);

  // query params
  const qUser   = url.searchParams.get("user")  || ""; // CREATED_USERNAME
  const startIso = url.searchParams.get("start") || new Date().toISOString().slice(0, 10);
  const endIso   = url.searchParams.get("end")   || startIso;

  // convert to DD-MM-YYYY (sesuai bind di SQL)
  const b_start = isoToDDMMYYYY(startIso);
  const b_end   = isoToDDMMYYYY(endIso);

  // siapkan LIKE pattern; jika kosong -> %
  const p_user = qUser ? `%${qUser}%` : "%";

  const sql = `
    SELECT 
      '-'                                             AS CHIP_ID,
      B.NIK,
      B.NAMA_LGKP                                     AS NAMA_LENGKAP,
      B.CURRENT_STATUS_CODE,
      TO_CHAR(B.TGL_LHR,'DD-MM-YYYY')                 AS TGL_LHR,
      TRUNC(MONTHS_BETWEEN(SYSDATE, B.TGL_LHR)/12)    AS UMUR,
      B.AGAMA,
      '-'                                             AS REQ_DATE,
      '-'                                             AS REQ_BY,
      TO_CHAR(A.CREATED,'DD-MM-YYYY')                 AS PRINTED_DATE,
      TO_CHAR(A.CREATED,'HH24:MI')                    AS PRINTED_HR,
      A.CREATED_USERNAME                              AS PRINTED_BY,
      B.NAMA_KEC,
      B.NAMA_KEL,
      B.ALAMAT,
      LPAD(TO_CHAR(B.NO_RT), 3, '0')                  AS RT,
      LPAD(TO_CHAR(B.NO_RW), 3, '0')                  AS RW,
      CASE WHEN B.KODE_POS IS NULL THEN '-' ELSE TO_CHAR(B.KODE_POS) END AS KODE_POS,
      B.STAT_KWN,
      B.JENIS_PKRJN
    FROM FINGERS A
    JOIN DEMOGRAPHICS B ON A.NIK = B.NIK
    WHERE 
      -- gunakan range agar index pada A.CREATED tetap terpakai
      A.CREATED >= TO_DATE(:b_start, 'DD-MM-YYYY')
      AND A.CREATED <  TO_DATE(:b_end,   'DD-MM-YYYY') + 1
      AND UPPER(A.CREATED_USERNAME) LIKE UPPER(:p_user)
    ORDER BY A.CREATED
  `;

  try {
    // ⛳️ Penting: nama binds HARUS sama dengan placeholder di SQL
    const binds = { b_start, b_end, p_user };

    const rows = await execRows(sql, binds, {}, "DB5");

    await Log.info({
      scope: "API",
      msg: "detail served",
      at: "/api/dashboard/userrekam/detail",
      tookMs: Date.now() - t0,
      extra: { rowCount: rows.length, startIso, endIso, qUser },
      binds,
    });

    return ok({ data: rows });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "detail error",
      at: "/api/dashboard/userrekam/detail",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e), stack: e?.stack },
      extra: { startIso, endIso, qUser },
    });
    return err("Terjadi kesalahan server. Silakan coba lagi.", 500);
  }
}
