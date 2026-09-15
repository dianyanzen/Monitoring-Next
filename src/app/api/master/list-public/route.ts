// FILE: src/app/api/master/list/route.ts
import { ok, err } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SQL = `
  SELECT
    USER_ID,
    NAMA_LGKP,
    NAMA_KANTOR,
    NIK,
    PENGAJUAN_S,
    PINDAHAN_S,
    PRR_S
  FROM VW_SIAK_LIST
`;

export async function GET(req: Request) {
  const t0 = Date.now();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const session = await readServerSession().catch(() => null);
  const user = session?.S_USER_ID || session?.NIK || undefined;

  try {
    const rows = await execRows(SQL);

    await Log.info({
      scope: "API",
      msg: "Master list served",
      at: "/api/master/list",
      tookMs: Date.now() - t0,
      user,
      ip,
      ua,
      extra: { rowCount: rows.length },
    });

    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Failed to load master list",
      at: "/api/master/list",
      tookMs: Date.now() - t0,
      user,
      ip,
      ua,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
    });
    return err(e?.message || "Tidak dapat memuat master list", 500);
  }
}

