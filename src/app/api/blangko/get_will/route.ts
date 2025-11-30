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

    const rows = await execRows(`SELECT NO_WIL, NAMA_WIL FROM SIAK_KODE_WIL ORDER BY NO_WIL`, {}, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/get_will",
      at: "/api/blangko/get_will",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: rows.length },
    });

    // Kembalikan dalam bentuk array + field items agar kompatibel
    return ok({ items: rows, data: rows, count: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/get_will_err",
      at: "/api/blangko/get_will",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat wilayah", 500);
  }
}
