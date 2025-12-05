import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BARANG ?? process.env.DB_ALIAS_PRR ?? "DB222";

const SQL = `
  SELECT NO AS ID, DESCRIP AS NAMA
  FROM SIAK_MASTER_ASET
  WHERE SECT = 6
  ORDER BY NO
`;

export async function GET() {
  const started = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

  try {
    const rows = await execRows(SQL, {}, {}, ORACLE_ALIAS);
    await Log.info({
      scope: "API",
      msg: "barang/aset-options",
      at: "/api/barang/aset-options",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { count: rows.length },
    });
    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/aset-options/error",
      at: "/api/barang/aset-options",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat daftar aset", 500);
  }
}
