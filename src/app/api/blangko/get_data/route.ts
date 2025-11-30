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
    const noKec = Number(body.no_kec ?? 0) || 0;
    const tgl = String(body.tanggal ?? "").trim();
    if (!noKec && noKec !== 0) return badRequest("No kecamatan wajib diisi.");
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tgl)) return badRequest("Tanggal tidak valid (DD-MM-YYYY).");

    const sql = `
      SELECT 
        NVL(AMBIL,0) AS AMBIL,
        NVL(RUSAK,0) AS RUSAK,
        NVL(PENGEMBALIAN,0) AS PENGEMBALIAN
      FROM SIAK_MONEV_BLANGKO
      WHERE NO_KEC = :no_kec
        AND TO_CHAR(TANGGAL,'DD-MM-YYYY') = :tgl
    `;

    const rows = await execRows(sql, { no_kec: noKec, tgl }, {}, ORACLE_ALIAS);
    const data = rows?.[0] ?? { AMBIL: 0, RUSAK: 0, PENGEMBALIAN: 0 };

    await Log.info({
      scope: "API",
      msg: "blangko/get_data",
      at: "/api/blangko/get_data",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { noKec, tgl },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/get_data_err",
      at: "/api/blangko/get_data",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data blangko", 500);
  }
}
