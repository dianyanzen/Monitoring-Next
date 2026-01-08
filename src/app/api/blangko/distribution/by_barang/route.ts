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
    const jnsBarang = Number(body.jns_barang ?? body.jenis_barang ?? 0) || 0;

    const sql = `
      SELECT
        NO_WIL,
        NAMA_WIL,
        JENIS_BARANG,
        NAMA_BARANG,
        NVL(JUMLAH,0) AS JUMLAH,
        TO_CHAR(TANGGAL,'DD-MM-YYYY') AS TANGGAL
      FROM SIAK_MONEV_WILAYAH_STOK
      WHERE (:jns = 0 OR JENIS_BARANG = :jns)
      ORDER BY NO_WIL, JENIS_BARANG
    `;
    const items = await execRows(sql, { jns: jnsBarang }, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/distribution/by_barang",
      at: "/api/blangko/distribution/by_barang",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: items.length, jnsBarang },
    });

    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/distribution/by_barang_err",
      at: "/api/blangko/distribution/by_barang",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat rekap per barang", 500);
  }
}
