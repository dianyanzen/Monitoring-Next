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
    const noWil = Number(body.no_wil ?? body.no_kec ?? body.noKec ?? 0) || 0;

    const sql = `
      SELECT
        NO_WIL,
        NAMA_WIL,
        JENIS_BARANG,
        NAMA_BARANG,
        NVL(JUMLAH,0) AS JUMLAH,
        TO_CHAR(TANGGAL,'DD-MM-YYYY') AS TANGGAL
      FROM SIAK_MONEV_WILAYAH_STOK
      WHERE (:no_wil = 0 OR NO_WIL = :no_wil)
      ORDER BY NO_WIL, JENIS_BARANG
    `;
    const items = await execRows(sql, { no_wil: noWil }, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/distribution/by_wilayah",
      at: "/api/blangko/distribution/by_wilayah",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: items.length, noWil },
    });

    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/distribution/by_wilayah_err",
      at: "/api/blangko/distribution/by_wilayah",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat rekap per wilayah", 500);
  }
}
