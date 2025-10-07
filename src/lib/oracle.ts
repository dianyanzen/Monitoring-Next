import oracledb from "oracledb";

// Jangan import { Connection, Pool } karena tidak diekspor langsung
type Connection = InstanceType<typeof oracledb.Connection>;
type Pool = InstanceType<typeof oracledb.Pool>;


/**
 * Oracle manager fleksibel:
 * - Multi-alias: "DB", "WEBDB", "DB222", "DB2", dst. (mengikuti .env kamu)
 * - Pooling per-alias + hot-reload safe (pakai global map)
 * - ENV fleksibel: <ALIAS>_CONN ATAU (<ALIAS>_HOST + _PORT + (_DATABASE | _SERVICE_NAME))
 * - Helper withConnection(alias, fn) untuk auto-open/close
 */
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

// ─────────────────────────────────────────────
// 🌐 Global Pool Map (agar aman dari hot-reload)
// ─────────────────────────────────────────────
const g = globalThis as unknown as { __ORACLE_POOLS__?: Map<string, Pool> };
if (!g.__ORACLE_POOLS__) g.__ORACLE_POOLS__ = new Map();
const pools = g.__ORACLE_POOLS__;

// ─────────────────────────────────────────────
// 🧩 Util: Ambil Credential dari .env
// ─────────────────────────────────────────────
function buildConnectString(prefix: string): string {
  const direct = process.env[`${prefix}_CONN`];
  if (direct) return direct;

  const HOST = process.env[`${prefix}_HOST`];
  const PORT = process.env[`${prefix}_PORT`];
  const DB = process.env[`${prefix}_DATABASE`] || process.env[`${prefix}_SERVICE_NAME`];

  if (!HOST || !PORT || !DB)
    throw new Error(`❌ ENV ${prefix}_CONN atau kombinasi ${prefix}_HOST/_PORT/_DATABASE belum lengkap.`);

  return `${HOST}:${PORT}/${DB}`;
}

function getCred(alias: string) {
  const A = alias.toUpperCase();
  const user = process.env[`${A}_USERNAME`] || process.env[`${A}_USER`];
  const password = process.env[`${A}_PASSWORD`] || process.env[`${A}_PASS`];
  const connectString = process.env[`${A}_CONN`] || buildConnectString(A);

  if (!user || !password || !connectString) {
    throw new Error(`❌ ENV ${A}_USERNAME/_PASSWORD/_CONN tidak lengkap`);
  }

  return { user, password, connectString };
}

// ─────────────────────────────────────────────
// 🧠 Pool Manager: Reuse or Create Oracle Pool
// ─────────────────────────────────────────────
async function getPool(alias: string): Promise<Pool> {
  const key = alias.toUpperCase();
  if (pools.has(key)) return pools.get(key)!;

  const cred = getCred(key);
  const pool = await oracledb.createPool({
    user: cred.user,
    password: cred.password,
    connectString: cred.connectString,
    poolMin: 1,
    poolMax: 6,              // cukup untuk dashboard use case
    poolIncrement: 1,
    queueTimeout: 10000,     // 10 detik timeout
    stmtCacheSize: 20,       // ringan tapi cepat
  });

  pools.set(key, pool);
  console.log(`✅ Oracle pool created [${key}]`);
  return pool;
}

// ─────────────────────────────────────────────
// 🔌 Ambil Connection dari Pool
// ─────────────────────────────────────────────
export async function getOracleConnection(alias = "DB"): Promise<Connection> {
  const pool = await getPool(alias);
  return pool.getConnection();
}

// ─────────────────────────────────────────────
// 🧰 Helper: Jalankan Query Auto-Close Connection
// ─────────────────────────────────────────────
export async function withConnection<T>(
  alias: string,
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  let conn: Connection | null = null;
  try {
    conn = await getOracleConnection(alias);
    const result = await fn(conn);

    // Commit hanya jika ada perubahan
    try {
      if (conn && (await conn.getStatementInfo("COMMIT"))) await conn.commit();
    } catch {
      // ignore jika bukan DML
    }

    return result;
  } catch (err) {
    console.error(`❌ Oracle error [${alias}]:`, err);
    throw err;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (closeErr) {
        console.warn(`⚠️ Gagal menutup koneksi [${alias}]:`, closeErr);
      }
    }
  }
}

// ─────────────────────────────────────────────
// ❤️ Health Checker: Tes koneksi tiap alias
// ─────────────────────────────────────────────
export async function checkOracleHealth(
  aliases: string[] = ["DB"]
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const a of aliases) {
    try {
      await withConnection(a, async (c) => {
        await c.execute("SELECT 1 AS OK FROM DUAL");
      });
      result[a] = true;
    } catch {
      result[a] = false;
    }
  }
  return result;
}