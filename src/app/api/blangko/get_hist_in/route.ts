import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

const HISTORY_SQL = `
  SELECT TANGGAL, JUMLAH, KET, CREATED_BY
  FROM (
    SELECT
      TO_CHAR(TANGGAL_MASUK,'DD-MM-YYYY') AS TANGGAL,
      NVL(JUMLAH,0) AS JUMLAH,
      NVL(KET,'') AS KET,
      NVL(CREATED_BY,'-') AS CREATED_BY,
      ROW_NUMBER() OVER (ORDER BY TANGGAL_MASUK DESC) AS RNK
    FROM SIAK_BLANGKO
  )
  WHERE RNK <= 5
  ORDER BY RNK
`;

const TODAY_SQL = `
  SELECT
    TO_CHAR(TANGGAL_MASUK,'DD-MM-YYYY') AS TANGGAL,
    NVL(JUMLAH,0) AS JUMLAH,
    NVL(KET,'') AS KET,
    NVL(CREATED_BY,'-') AS CREATED_BY
  FROM SIAK_BLANGKO
  WHERE TO_CHAR(TANGGAL_MASUK,'DD-MM-YYYY') = :tgl
`;

const toDMY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const tglRaw = String(body.tanggal ?? "").trim();
    const tanggal = /^\d{2}-\d{2}-\d{4}$/.test(tglRaw) ? tglRaw : toDMY(new Date());

    const [historyRowsRaw, todayRowsRaw] = await Promise.all([
      execRows(HISTORY_SQL, {}, {}, ORACLE_ALIAS),
      execRows(TODAY_SQL, { tgl: tanggal }, {}, ORACLE_ALIAS),
    ]);
    const historyRows = Array.isArray(historyRowsRaw) ? historyRowsRaw : [];
    const today = Array.isArray(todayRowsRaw) && todayRowsRaw.length ? todayRowsRaw[0] : null;

    await Log.info({
      scope: "API",
      msg: "blangko/get_hist_in",
      at: "/api/blangko/get_hist_in",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: historyRows.length, tanggal, todayExists: !!today },
    });

    return ok({ items: historyRows, today, count: historyRows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/get_hist_in_err",
      at: "/api/blangko/get_hist_in",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat histori blangko", 500);
  }
}
