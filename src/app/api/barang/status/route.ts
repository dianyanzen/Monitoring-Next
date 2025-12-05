import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BARANG ?? process.env.DB_ALIAS_PRR ?? "DB222";

const SQL = `
  SELECT 
    A.BARANG_ID,
    A.JENIS_BARANG,
    A.SATUAN,
    A.HARGA,
    NVL(B.JML, 0) || ' ' || A.SATUAN AS JML_MASUK,
    NVL(C.JML, 0) || ' ' || A.SATUAN AS JML_KELUAR,
    (NVL(B.JML, 0) - NVL(C.JML, 0)) || ' ' || A.SATUAN AS SALDO,
    (NVL(B.JML, 0) - NVL(C.JML, 0)) * A.HARGA AS HARGA_ASET
  FROM SIAK_MASTER_BARANG A 
  LEFT JOIN (
    SELECT KODE_BARANG, SUM(JUMLAH) AS JML FROM SIAK_BARANG_MASUK GROUP BY KODE_BARANG
  ) B ON A.BARANG_ID = B.KODE_BARANG
  LEFT JOIN (
    SELECT KODE_BARANG, SUM(JUMLAH) AS JML FROM SIAK_BARANG_KELUAR GROUP BY KODE_BARANG
  ) C ON A.BARANG_ID = C.KODE_BARANG
  ORDER BY A.BARANG_ID
`;

export async function GET() {
  const started = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

  try {
    const rows = await execRows(SQL, {}, {}, ORACLE_ALIAS);
    await Log.info({
      scope: "API",
      msg: "barang/status/list",
      at: "/api/barang/status",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { count: rows.length },
    });
    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/status/error",
      at: "/api/barang/status",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat status barang", 500);
  }
}
