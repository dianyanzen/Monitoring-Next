import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
const isoToDDMMYYYY = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
};

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);

  const qUser = (url.searchParams.get("user") || "").trim();
  let startIso = (url.searchParams.get("start") || "").trim();
  let endIso = (url.searchParams.get("end") || "").trim();

  const isISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isISO(startIso) && !isISO(endIso)) {
    startIso = todayISO();
    endIso = startIso;
  } else {
    if (!isISO(startIso)) startIso = endIso || todayISO();
    if (!isISO(endIso)) endIso = startIso;
  }
  if (endIso < startIso) [startIso, endIso] = [endIso, startIso];

  const b_start = isoToDDMMYYYY(startIso);
  const b_end = isoToDDMMYYYY(endIso);
  const p_user = qUser ? `%${qUser}%` : "%";

  const sql = `
    SELECT 
      NVL(B.NAMA_KEC,'-') AS NAMA_KEC,
      COUNT(1)            AS JML
    FROM FINGERS A
    JOIN DEMOGRAPHICS B ON A.NIK = B.NIK
    WHERE A.CREATED >= TO_DATE(:b_start,'DD-MM-YYYY')
      AND A.CREATED <  TO_DATE(:b_end,'DD-MM-YYYY') + 1
      AND UPPER(A.CREATED_USERNAME) LIKE UPPER(:p_user)
    GROUP BY B.NAMA_KEC
    ORDER BY B.NAMA_KEC
  `;

  try {
    const binds = { b_start, b_end, p_user };
    const rows = await execRows(sql, binds, {}, "DB5");
    await Log.info({
      scope: "API",
      msg: "kec served",
      at: "/api/dashboard/userrekam/detail/kec",
      tookMs: Date.now() - t0,
      extra: { rowCount: rows.length, startIso, endIso, qUser },
      binds,
    });
    return ok({ data: rows });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "kec error",
      at: "/api/dashboard/userrekam/detail/kec",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
      extra: { startIso, endIso, qUser },
    });
    return err("Terjadi kesalahan server. Silakan coba lagi.", 500);
  }
}
