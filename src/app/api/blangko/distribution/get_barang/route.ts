import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(_req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const sql = `
      SELECT
        NO AS JENIS_BARANG,
        DESCRIP AS NAMA_BARANG
      FROM SIAK_MASTER_ASET
      WHERE SECT = 6
      ORDER BY NO
    `;
    const items = await execRows(sql, {}, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/distribution/get_barang",
      at: "/api/blangko/distribution/get_barang",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: items.length },
    });

    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/distribution/get_barang_err",
      at: "/api/blangko/distribution/get_barang",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat jenis barang", 500);
  }
}
