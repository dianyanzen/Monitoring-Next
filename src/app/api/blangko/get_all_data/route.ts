import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const tgl = String(body.tanggal ?? "").trim();
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tgl)) return badRequest("Tanggal tidak valid (DD-MM-YYYY).");

    const sql = `
      SELECT 
        NVL(SUM(AMBIL),0) AS AMBIL,
        NVL(SUM(RUSAK),0) AS RUSAK,
        NVL(SUM(PENGEMBALIAN),0) AS PENGEMBALIAN,
        NVL(SUM(AMBIL) - (SUM(RUSAK) + SUM(PENGEMBALIAN)),0) AS TOTAL
      FROM SIAK_MONEV_BLANGKO
      WHERE TO_CHAR(TANGGAL,'DD-MM-YYYY') = :tgl
    `;

    const rows = await execRows(sql, { tgl }, {}, ORACLE_ALIAS);
    const data = rows?.[0] ?? { AMBIL: 0, RUSAK: 0, PENGEMBALIAN: 0, TOTAL: 0 };

    await Log.info({
      scope: "API",
      msg: "blangko/get_all_data",
      at: "/api/blangko/get_all_data",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { tgl },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/get_all_data_err",
      at: "/api/blangko/get_all_data",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat total blangko", 500);
  }
}
