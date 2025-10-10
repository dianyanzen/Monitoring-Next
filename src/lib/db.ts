// FILE: /lib/db.ts
import oracledb from "oracledb";
import { getOracleConnection } from "./oracle";
import { Log } from "./log"; // <-- pastikan file /lib/log.ts sudah ada (langkah sebelumnya)

type OracleConnection = InstanceType<typeof oracledb.Connection>; 
type ExecuteOptions = Parameters<OracleConnection["execute"]>[2] & Record<string, any>;

// Ringkasan SQL untuk log (hindari file log bengkak)
function summarizeSql(sql: string) {
  const s = sql.replace(/\s+/g, " ").trim();
  return s.length > 800 ? s.slice(0, 800) + " ...[truncated]" : s;
}

// --- HELPERS LOG --------------------------------------------------------------
async function logOk(scope: "DB", msg: string, t0: number, at: string, sql: string, binds?: Record<string, unknown>) {
  await Log.info({
    scope,
    msg,
    at,
    tookMs: Date.now() - t0,
    sql: summarizeSql(sql),
    binds
  });
}
async function logErr(scope: "DB", msg: string, t0: number, at: string, sql: string, binds: Record<string, unknown> | undefined, err: any) {
  await Log.error({
    scope,
    msg,
    at,
    tookMs: Date.now() - t0,
    sql: summarizeSql(sql),
    binds,
    err: { name: err?.name ?? "Error", message: err?.message ?? String(err) }
  });
}

// --- SELECT banyak baris ------------------------------------------------------
export async function execRows<T = any>(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<T[]> {
  const t0 = Date.now();
  const conn = await getOracleConnection(alias);
  try {
    const res = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...(opt || {}),
    });
    await logOk("DB", "SELECT ok", t0, alias, sql, binds);
    return (res.rows as T[]) ?? [];
  } catch (err: any) {
    await logErr("DB", "SELECT error", t0, alias, sql, binds, err);
    throw err;
  } finally {
    try { await conn.close(); } catch {}
  }
}

// --- SELECT 1 baris -----------------------------------------------------------
export async function execOne<T = any>(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<T | null> {
  const rows = await execRows<T>(sql, binds, opt, alias);
  return rows.length ? rows[0] : null;
}

// --- SELECT 1 kolom teks (alias-kan sebagai VAL) ------------------------------
export async function execOneText(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<string> {
  const row = await execOne<{ VAL?: string }>(sql, binds, opt, alias);
  return (row?.VAL ?? "").toString().trim();
}

// --- DML (INSERT/UPDATE/DELETE) ----------------------------------------------
export async function execDml(
  sql: string,
  binds: Record<string, unknown> = {},
  opt: ExecuteOptions = {},
  alias = "DB"
): Promise<number> {
  const t0 = Date.now();
  const conn = await getOracleConnection(alias);
  try {
    const res = await conn.execute(sql, binds, { autoCommit: true, ...(opt || {}) });
    await logOk("DB", "DML ok", t0, alias, sql, binds);
    return res.rowsAffected ?? 0;
  } catch (err: any) {
    await logErr("DB", "DML error", t0, alias, sql, binds, err);
    throw err;
  } finally {
    try { await conn.close(); } catch {}
  }
}

// --- Transaksi eksplisit ------------------------------------------------------
export async function withTransaction<T>(
  work: (conn: OracleConnection) => Promise<T>,
  alias = "DB"
): Promise<T> {
  const t0 = Date.now();
  const conn = await getOracleConnection(alias);
  try {
    const out = await work(conn);
    await conn.commit();
    await Log.info({
      scope: "DB",
      msg: "TX commit",
      at: alias,
      tookMs: Date.now() - t0,
    });
    return out;
  } catch (e: any) {
    try { await conn.rollback(); } catch {}
    await Log.warn({
      scope: "DB",
      msg: "TX rollback",
      at: alias,
      tookMs: Date.now() - t0,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) }
    });
    throw e;
  } finally {
    try { await conn.close(); } catch {}
  }
}
