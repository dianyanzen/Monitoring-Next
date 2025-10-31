// FILE: /lib/oracle.ts
import oracledb from "oracledb";
import { Log } from "./log";

// Tipe instance (karena Connection/Pool tidak diekspor sebagai type langsung)
type Connection = InstanceType<typeof oracledb.Connection>;
type Pool = InstanceType<typeof oracledb.Pool>;

/**
 * Oracle manager:
 * - Multi-alias: "DB", "WEBDB", "DB222", dst. (ikuti .env)
 * - Pool per-alias + hot-reload safe (cache di global)
 * - ENV fleksibel:
 *     <ALIAS>_CONN  (host:port/service)
 *       ATAU
 *     <ALIAS>_{HOST,PORT,SERVICE_NAME|DATABASE}
 * - withConnection(alias, fn): buka → fn(conn) → tutup (tanpa auto-commit di sini)
 */

// Format hasil SELECT = object
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// Jangan set autoCommit global; tentukan di execute({ autoCommit: true }) saat DML
oracledb.autoCommit = false;
// Convert kolom BLOB langsung menjadi Buffer (dibutuhkan untuk foto)
oracledb.fetchAsBuffer = [oracledb.BLOB];

// ─────────────────────────────────────────────
// 🌐 Global pool map (aman untuk hot-reload Next.js)
// ─────────────────────────────────────────────
const g = globalThis as unknown as { __ORACLE_POOLS__?: Map<string, Pool> };
if (!g.__ORACLE_POOLS__) g.__ORACLE_POOLS__ = new Map();
const pools = g.__ORACLE_POOLS__;

// ─────────────────────────────────────────────
// 🔧 ENV helpers
// ─────────────────────────────────────────────
function connectStringFromEnv(prefix: string): string {
  const direct = process.env[`${prefix}_CONN`];
  if (direct && direct.trim()) return direct.trim(); // "host:port/service"

  const HOST = process.env[`${prefix}_HOST`];
  const PORT = process.env[`${prefix}_PORT`];
  const SVC  = process.env[`${prefix}_SERVICE_NAME`] || process.env[`${prefix}_DATABASE`];

  if (!HOST || !PORT || !SVC) {
    throw new Error(
      `ENV ${prefix}_CONN atau ${prefix}_{HOST,PORT,SERVICE_NAME|DATABASE} belum lengkap.`
    );
  }
  return `${HOST}:${PORT}/${SVC}`;
}

function getCredentials(alias: string) {
  const A = alias.toUpperCase();
  const user = process.env[`${A}_USERNAME`] || process.env[`${A}_USER`];
  const password = process.env[`${A}_PASSWORD`] || process.env[`${A}_PASS`];
  const connectString = connectStringFromEnv(A);

  if (!user || !password || !connectString) {
    throw new Error(`ENV ${A}_USERNAME/_PASSWORD/_CONN tidak lengkap`);
  }
  return { user, password, connectString };
}

// ─────────────────────────────────────────────
// 🧠 Pool manager
// ─────────────────────────────────────────────
async function getPool(alias = "DB"): Promise<Pool> {
  const key = alias.toUpperCase();
  if (pools.has(key)) return pools.get(key)!;

  const { user, password, connectString } = getCredentials(key);

  const pool = await oracledb.createPool({
    user,
    password,
    connectString,
    poolMin: 0,
    poolMax: 10,        // cukup untuk dashboard/API ringan
    poolIncrement: 1,
    queueTimeout: 10_000,
    poolPingInterval: 60,
    homogeneous: true,
    stmtCacheSize: 40,  // cache statement moderat
  });

  pools.set(key, pool);
  // console.log(`✅ Oracle pool created [${key}]`);
  await Log.info({ scope: "SYSTEM", msg: `Oracle pool created`, extra: { alias: key } });

  return pool;
}

// ─────────────────────────────────────────────
// 🔌 Ambil koneksi
// ─────────────────────────────────────────────
export async function getOracleConnection(alias = "DB"): Promise<Connection> {
  const pool = await getPool(alias);
  return pool.getConnection();
}

// ─────────────────────────────────────────────
// 🧰 Jalankan dengan koneksi (tanpa auto-commit implicit)
// ─────────────────────────────────────────────
export async function withConnection<T>(
  alias: string,
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  let conn: Connection | null = null;
  try {
    conn = await getOracleConnection(alias);
    return await fn(conn);
  } catch (err) {
    await Log.error({ scope: "DB", msg: "Oracle error", extra: { alias }, err: err as any });
    throw err;
  } finally {
    if (conn) {
      try { await conn.close(); }
      catch (e) { console.warn(`⚠️ Gagal menutup koneksi [${alias}]:`, e); }
    }
  }
}

// ─────────────────────────────────────────────
// ❤️ Health check (ping DUAL)
// ─────────────────────────────────────────────
export async function checkOracleHealth(
  aliases: string[] = ["DB"]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const a of aliases) {
    try {
      await withConnection(a, (c) => c.execute("SELECT 1 AS OK FROM DUAL"));
      result[a] = true;
    } catch {
      result[a] = false;
    }
  }
  return result;
}
