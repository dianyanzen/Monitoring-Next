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
    JAM_MASUK,
    JAM_KELUAR
  FROM VW_SIAK_MASTER_ABSENSI
  WHERE USER_ID <> 'assist_yz'
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
      JAM_MASUK: string | null;
      JAM_KELUAR: string | null;
    }>(SQL);

    const data = rows.map((row) => ({
      user_id: row.USER_ID?.trim() ?? "",
      nama_lgkp: row.NAMA_LGKP?.trim() ?? "",
      nama_kantor: row.NAMA_KANTOR?.trim() ?? "",
      nik: row.NIK?.trim() ?? "",
      jam_masuk: row.JAM_MASUK ?? null,
      jam_keluar: row.JAM_KELUAR ?? null,
    }));

    await Log.info({
      scope: "API",
      msg: "Master absensi served",
      at: "/api/master/absensi",
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
      msg: "Failed to load master absensi",
      at: "/api/master/absensi",
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

    return err("Tidak dapat memuat master absensi", 500);
  }
}
