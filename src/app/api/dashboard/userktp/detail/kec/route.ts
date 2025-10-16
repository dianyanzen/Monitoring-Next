// FILE: src/app/api/dashboard/userktp/detail/kec/route.ts
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// helper today ISO
const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);

  const p_user_raw = (url.searchParams.get("user") || "").trim();
  let p_start = (url.searchParams.get("start") || "").trim();
  let p_end = (url.searchParams.get("end") || "").trim();

  // fallback & sanitize
  const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isISO(p_start) && !isISO(p_end)) {
    p_start = todayISO();
    p_end = p_start;
  } else {
    if (!isISO(p_start)) p_start = p_end || todayISO();
    if (!isISO(p_end)) p_end = p_start;
  }
  if (p_end < p_start) [p_start, p_end] = [p_end, p_start];

  const sql = `
    SELECT 
      NVL(B.NAMA_KEC, '-') AS NAMA_KEC,
      COUNT(1) AS JML
    FROM CARD_MANAGEMENT@DB5CETAK A
    LEFT JOIN DEMOGRAPHICS B ON A.NIK = B.NIK
    WHERE 
      -- rentang tanggal INKLUSIF tanpa TRUNC (agar sargable)
      NVL(A.LAST_UPDATE, A.PERSONALIZED_DATE) >= TO_DATE(:p_start,'YYYY-MM-DD')
      AND NVL(A.LAST_UPDATE, A.PERSONALIZED_DATE) <  TO_DATE(:p_end,'YYYY-MM-DD') + 1
      AND (
        :p_user = '' OR
        UPPER(NVL(A.LAST_UPDATED_USERNAME, A.CREATED_USERNAME)) LIKE '%' || UPPER(:p_user) || '%'
      )
    GROUP BY B.NAMA_KEC
    ORDER BY B.NAMA_KEC
  `;

  try {
    const binds = { p_user: p_user_raw, p_start, p_end };
    const rows = await execRows(sql, binds, {}, "DB2");
    await Log.info({
      scope: "API",
      msg: "kec served",
      at: "/api/dashboard/userktp/detail/kec",
      tookMs: Date.now() - t0,
      extra: { rowCount: rows.length },
      binds,
    });
    return ok({ data: rows });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "kec error",
      at: "/api/dashboard/userktp/detail/kec",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message ?? "Failed", 500);
  }
}
