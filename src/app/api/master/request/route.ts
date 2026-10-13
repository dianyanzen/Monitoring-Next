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
    PENGAJUAN_B,
    PENGAJUAN_N,
    PENGAJUAN_Y
  FROM VW_SIAK_MASTER_PENGAJUAN
`;

export async function GET(req: Request) {
  const startedAt = Date.now();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;

  const session = await readServerSession().catch(() => null);
  const user = session?.S_USER_ID || session?.NIK || undefined;

  try {
    const rows = await execRows<{
      USER_ID: string;
      NAMA_LGKP: string;
      NAMA_KANTOR: string;
      NIK: string;
      PENGAJUAN_B: number;
      PENGAJUAN_N: number;
      PENGAJUAN_Y: number;
    }>(SQL);

    const data = rows.map((row) => ({
      user_id: row.USER_ID?.trim() ?? "",
      nama_lgkp: row.NAMA_LGKP?.trim() ?? "",
      nama_kantor: row.NAMA_KANTOR?.trim() ?? "",
      nik: row.NIK?.trim() ?? "",
      pengajuan_b: Number(row.PENGAJUAN_B) || 0,
      pengajuan_n: Number(row.PENGAJUAN_N) || 0,
      pengajuan_y: Number(row.PENGAJUAN_Y) || 0,
    }));

    await Log.info({
      scope: "API",
      msg: "Master request served",
      at: "/api/master/request",
      tookMs: Date.now() - startedAt,
      user,
      ip,
      ua,
      extra: { rowCount: data.length },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "Failed to load master request",
      at: "/api/master/request",
      tookMs: Date.now() - startedAt,
      user,
      ip,
      ua,
      err: {
        name: e?.name || "Error",
        message: e?.message || String(e),
        stack: e?.stack,
      },
    });

    return err("Tidak dapat memuat master request", 500);
  }
}
