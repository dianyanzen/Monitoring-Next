// FILE: src/app/api/dashboard/userktp/summary/route.ts
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
        at: "/api/dashboard/userktp/summary",
        user, ip, ua,
        extra: { startIso, endIso },
        tookMs: Date.now() - t0,
      });
      return badRequest("Missing date range (?start=YYYY-MM-DD&end=YYYY-MM-DD)");
    }

    const b_start = isoToDDMMYYYY(startIso);
    const b_end = isoToDDMMYYYY(endIso);

    const sql = `
      SELECT USER_ID, TGL, MULAI, SELESAI, JML
      FROM (
        /* —— Baris per user dari CARD_MANAGEMENT —— */
        SELECT
          /* 1 */ CASE
                    WHEN LOWER(A.LAST_UPDATED_USERNAME) IS NULL
                      THEN LOWER(TO_CHAR(A.CREATED_USERNAME))
                    ELSE LOWER(TO_CHAR(A.LAST_UPDATED_USERNAME))
                  END AS USER_ID,
          /* 2 */ CAST(:b_start || ' - ' || :b_end AS VARCHAR2(21)) AS TGL,
          /* 3 */ CAST(:b_start AS VARCHAR2(10)) AS MULAI,
          /* 4 */ CAST(:b_end   AS VARCHAR2(10)) AS SELESAI,
          /* 5 */ COUNT(1) AS JML
        FROM CARD_MANAGEMENT@DB5CETAK A
        WHERE
          CASE
            WHEN TRUNC(A.LAST_UPDATE) IS NULL THEN TRUNC(A.PERSONALIZED_DATE)
            ELSE TRUNC(A.LAST_UPDATE)
          END BETWEEN TO_DATE(:b_start,'DD-MM-YYYY')
                AND TO_DATE(:b_end,'DD-MM-YYYY') + 1 - (1/86400)
          AND CASE
                WHEN UPPER(A.LAST_UPDATED_USERNAME) IS NULL
                  THEN UPPER(TO_CHAR(A.CREATED_USERNAME))
                ELSE UPPER(TO_CHAR(A.LAST_UPDATED_USERNAME))
              END NOT IN (SELECT UPPER(USER_BCARD) FROM SIAK_CETAK_GOIB WHERE IS_ACTIVE = 1)
        GROUP BY
          CASE
            WHEN LOWER(A.LAST_UPDATED_USERNAME) IS NULL
              THEN LOWER(TO_CHAR(A.CREATED_USERNAME))
            ELSE LOWER(TO_CHAR(A.LAST_UPDATED_USERNAME))
          END

        UNION ALL

        /* —— Baris khusus LUDO —— */
        SELECT
          /* 1 */ '32730000ludo' AS USER_ID,
          /* 2 */ TO_CHAR(SYSDATE,'DD-MM-YYYY') AS TGL,
          /* 3 */ CAST('-' AS VARCHAR2(10)) AS MULAI,
          /* 4 */ CAST('-' AS VARCHAR2(10)) AS SELESAI,
          /* 5 */ (D.AMBIL - D.RUSAK - D.PENGEMBALIAN) AS JML
        FROM SIAK_MONEV_BLANGKO_LUDO D
        WHERE TRUNC(D.TANGGAL) = TRUNC(SYSDATE)
      )
      ORDER BY JML DESC
    `;

    const binds = { b_start, b_end };
    const rows = await execRows(sql, binds);

    const took = Date.now() - t0;
    await Log.info({
      scope: "DB",
      msg: "Fetch summary user KTP",
      at: "CARD_MANAGEMENT@DB5CETAK → summary",
      user, ip, ua, tookMs: took,
      sql, binds, extra: { rowCount: rows.length },
    });
    await Log.info({
      scope: "API",
      msg: "Summary user KTP served",
      at: "/api/dashboard/userktp/summary",
      user, ip, ua, tookMs: took,
      extra: { startIso, endIso, rowCount: rows.length },
    });

    return ok(rows);
  } catch (e: any) {
    const took = Date.now() - t0;
    await Log.error({
      scope: "API",
      msg: "Error summary user KTP",
      at: "/api/dashboard/userktp/summary",
      user, ip, ua, tookMs: took,
      err: { name: e?.name || "Error", message: e?.message || String(e), stack: e?.stack },
      extra: { startIso, endIso },
    });
    return err(e?.message || "Failed to load summary", 500);
  }
}
