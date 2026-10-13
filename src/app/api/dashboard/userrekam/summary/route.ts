// FILE: src/app/api/dashboard/userrekam/summary/route.ts
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

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
  const startIso = url.searchParams.get("start");
  const endIso = url.searchParams.get("end");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const s = await readServerSession().catch(() => null);
  const user = s?.S_USER_ID || s?.NIK || undefined;

  try {
    if (!startIso || !endIso) {
      await Log.warn({
        scope: "API",
        msg: "Missing date range in query",
        at: "/api/dashboard/userrekam/summary",
        user,
        ip,
        ua,
        extra: { startIso, endIso },
        tookMs: Date.now() - t0,
      });
      return badRequest(
        "Missing date range (?start=YYYY-MM-DD&end=YYYY-MM-DD)"
      );
    }

    if (endIso < startIso) {
      return badRequest("Invalid range: end must be >= start");
    }

    const b_start = isoToDDMMYYYY(startIso); // 08-12-2025
    const b_end = isoToDDMMYYYY(endIso);     // 08-12-2025

    const sql = `
      SELECT
        LOWER(A.CREATED_USERNAME)                 AS USER_ID,
        (:b_start || ' - ' || :b_end)             AS TGL,
        COUNT(*)                                   AS JML,
        /* jam rekam pertama di range (HH24:MI) */
        TO_CHAR(MIN(B.CREATED), 'HH24:MI')        AS MULAI,
        /* jam rekam terakhir di range (HH24:MI) */
        TO_CHAR(MAX(B.CREATED), 'HH24:MI')        AS SELESAI
      FROM DEMOGRAPHICS@DB5 A
      JOIN FINGERS@DB5      B ON A.NIK = B.NIK
      WHERE
        B.CREATED >= TO_DATE(:b_start, 'DD-MM-YYYY')
        AND B.CREATED <  TO_DATE(:b_end,   'DD-MM-YYYY') + 1
      GROUP BY LOWER(A.CREATED_USERNAME)
      ORDER BY JML DESC
    `;

    const binds = { b_start, b_end };
    const rows = await execRows(sql, binds);

    const took = Date.now() - t0;
    await Log.info({
      scope: "DB",
      msg: "Fetch summary user rekam",
      at: "FINGERS@DB5 → summary by CREATED_USERNAME",
      user,
      ip,
      ua,
      tookMs: took,
      sql,
      binds,
      extra: { rowCount: rows.length },
    });
    await Log.info({
      scope: "API",
      msg: "Summary user rekam served",
      at: "/api/dashboard/userrekam/summary",
      user,
      ip,
      ua,
      tookMs: took,
      extra: { startIso, endIso, rowCount: rows.length },
    });

    return ok(rows);
  } catch (e: any) {
    const took = Date.now() - t0;
    await Log.error({
      scope: "API",
      msg: "Error summary user rekam",
      at: "/api/dashboard/userrekam/summary",
      user,
      ip,
      ua,
      tookMs: took,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
      extra: { startIso, endIso },
    });
    return err("Failed to load summary", 500);
  }
}
