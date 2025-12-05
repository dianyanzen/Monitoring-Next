import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BARANG ?? process.env.DB_ALIAS_PRR ?? "DB222";

const SQL = `
  SELECT BARANG_ID, JENIS_BARANG, SATUAN, HARGA
  FROM SIAK_MASTER_BARANG
  ORDER BY BARANG_ID
`;

export async function GET() {
  const started = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

  try {
    const rows = await execRows(SQL, {}, {}, ORACLE_ALIAS);
    await Log.info({
      scope: "API",
      msg: "barang/options",
      at: "/api/barang/options",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { count: rows.length },
    });
    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/options/error",
      at: "/api/barang/options",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat daftar barang", 500);
  }
}
