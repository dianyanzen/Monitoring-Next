import type { NextRequest } from "next/server";
import { err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK_DINAS ?? process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const sql = `
      SELECT NVL(SUM(AMBIL), 0) AS JML
      FROM SIAK_MONEV_BLANGKO_LUDO
      WHERE TRUNC(TANGGAL) = TRUNC(SYSDATE)
    `;
    const rows = await execRows<{ JML?: number }>(sql, {}, {}, ORACLE_ALIAS);
    const jumLudo = Number(rows?.[0]?.JML ?? 0);

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/get_ludo",
      at: "/api/cetak_dinas/get_ludo",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { jumLudo },
    });

    return ok({ jum_ludo: jumLudo }, "Data ludo loaded");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/get_ludo_err",
      at: "/api/cetak_dinas/get_ludo",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal mengambil data ludo.", 500);
  }
}
