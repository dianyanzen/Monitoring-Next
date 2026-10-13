import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";
const NO_PROP = (process.env.NO_PROP ?? "32").trim();
const NO_KAB = (process.env.NO_KAB ?? "73").trim();

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const SQL = `
      SELECT NO_KEC,
             F5_GET_NAMA_KECAMATAN(:p_prop,:p_kab,NO_KEC) AS NAMA_KEC,
             TO_CHAR(UPDATE_DT,'DD-MM-YYYY') AS UPDATE_DT
      FROM (
        SELECT NO_KEC, UPDATE_DT,
               ROW_NUMBER() OVER (PARTITION BY NO_KEC ORDER BY UPDATE_DT DESC) AS RNK
        FROM SIAK_DISTRIBUSI_KEPING
      )
      WHERE RNK = 1
      ORDER BY NO_KEC
    `;

    const rows = await execRows(SQL, { p_prop: NO_PROP, p_kab: NO_KAB }, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/get_histkec_dist",
      at: "/api/blangko/get_histkec_dist",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: rows.length },
    });

    return ok({ items: rows, count: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/get_histkec_dist_err",
      at: "/api/blangko/get_histkec_dist",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat histori distribusi kecamatan", 500);
  }
}
