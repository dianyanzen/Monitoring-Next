// FILE: /lib/db.ts
import oracledb from "oracledb";
import { getOracleConnection } from "./oracle";

// Ambil tipe method execute tanpa import tambahan
type OracleConnection = InstanceType<typeof oracledb.Connection>;
type ExecuteOptions = Parameters<OracleConnection["execute"]>[2] & Record<string, any>;

// SELECT banyak baris
export async function execRows<T = any>(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<T[]> {
  const conn = await getOracleConnection(alias);
  try {
    const res = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...(opt || {}),
    });
    return (res.rows as T[]) ?? [];
  } finally {
    await conn.close().catch(() => {});
  }
}

// SELECT 1 baris
export async function execOne<T = any>(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<T | null> {
  const rows = await execRows<T>(sql, binds, opt, alias);
  return rows.length ? rows[0] : null;
}

// SELECT 1 kolom teks (alias-kan sebagai VAL)
export async function execOneText(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<string> {
  const row = await execOne<{ VAL?: string }>(sql, binds, opt, alias);
  return (row?.VAL ?? "").toString().trim();
}

// DML (INSERT/UPDATE/DELETE)
export async function execDml(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<number> {
  const conn = await getOracleConnection(alias);
  try {
    const res = await conn.execute(sql, binds, { autoCommit: true, ...(opt || {}) });
    return res.rowsAffected ?? 0;
  } finally {
    await conn.close().catch(() => {});
  }
}

// Transaksi eksplisit
export async function withTransaction<T>(
  work: (conn: OracleConnection) => Promise<T>,
  alias = "DB"
): Promise<T> {
  const conn = await getOracleConnection(alias);
  try {
    const out = await work(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch {}
    throw e;
  } finally {
    await conn.close().catch(() => {});
  }
}
