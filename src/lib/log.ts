// FILE: src/lib/log.ts
import { promises as fs } from "fs";
import path from "path";

type LogLevel = "INFO" | "WARN" | "ERROR";
type LogScope =
  | "API"
  | "DB"
  | "SESSION"
  | "MIDDLEWARE"
  | "SYSTEM"
  | "ACCOUNT"
  | "OTHER";

export type LogEntry = {
  level: LogLevel;
  scope: LogScope;
  msg: string;
  at?: string; // route/path or SQL id/alias
  user?: string; // S_USER_ID / NIK
  session?: string; // S_SESSION_ID
  ip?: string;
  ua?: string;
  tookMs?: number; // duration
  extra?: Record<string, any>; // free-form
  // when relevant:
  sql?: string;
  binds?: Record<string, unknown>;
  err?: { name: string; message: string; stack?: string };
};

/* ========== Time & Path Helpers ========== */
function nowParts() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const iso =
    `${yyyy}-${mm}-${dd} ` +
    `${String(d.getHours()).padStart(2, "0")}:` +
    `${String(d.getMinutes()).padStart(2, "0")}:` +
    `${String(d.getSeconds()).padStart(2, "0")}.` +
    `${String(d.getMilliseconds()).padStart(3, "0")}`;
  return { yyyy, mm, dd, iso };
}

function baseLogDir() {
  return process.env.LOG_DIR || path.join(process.cwd(), "logs");
}

/* ========== Sanitize & Safe Stringify ========== */
const MAX_JSON_LEN = 4000; // batasi ukuran payload per baris log

function summarizeSql(sql?: string) {
  if (!sql) return undefined;
  const s = sql.replace(/\s+/g, " ").trim();
  return s.length > 800 ? s.slice(0, 800) + " …[truncated]" : s;
}

/** Hapus/konversi nilai “berat” & cegah circular */
function safeReplacer() {
  const seen = new WeakSet<object>();
  return (_key: string, value: any) => {
    if (value === undefined) return undefined;

    // Hilangkan fungsi
    if (typeof value === "function") return undefined;

    // Buffer → ringkas
    if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(value)) {
      return `<Buffer ${value.length} bytes>`;
    }

    // Objek spesifik oracledb / koneksi → ringkas
    const ctor = value?.constructor?.name as string | undefined;
    if (
      ctor &&
      /ConnectDescription|Pool|Connection|Lob|ResultSet/i.test(ctor)
    ) {
      return `<${ctor}>`;
    }

    // Date → ISO
    if (value instanceof Date) return value.toISOString();

    // Cegah circular
    if (value && typeof value === "object") {
      if (seen.has(value)) return "<circular>";
      seen.add(value);
    }

    return value;
  };
}

function safeStringify(obj: any) {
  try {
    const s = JSON.stringify(obj, safeReplacer());
    return s.length > MAX_JSON_LEN ? s.slice(0, MAX_JSON_LEN) + " …[truncated]" : s;
  } catch {
    // fallback keras
    try {
      return String(obj);
    } catch {
      return "<unserializable>";
    }
  }
}

/* ========== Writer ========== */
export async function writeLog(entry: LogEntry) {
  const { yyyy, mm, dd, iso } = nowParts();
  const dir = path.join(baseLogDir(), `${yyyy}-${mm}`, dd);
  const file = path.join(dir, "log.txt");

  const head = `[${iso}] [${entry.level}] [${entry.scope}]`;

  // payload yang sudah dipangkas & aman
  const payload = {
    at: entry.at,
    user: entry.user,
    session: entry.session,
    ip: entry.ip,
    ua: entry.ua ? (entry.ua.length > 300 ? entry.ua.slice(0, 300) + " …" : entry.ua) : undefined,
    tookMs: entry.tookMs,
    sql: summarizeSql(entry.sql),
    binds: entry.binds,
    extra: entry.extra,
    err: entry.err
      ? { name: entry.err.name, message: entry.err.message } // jangan tulis stack agar ringkas
      : undefined,
  };

  const line = `${head} ${entry.msg} ${safeStringify(payload)}\n`;

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(file, line, "utf8");
  } catch (e: any) {
    // Jika penulisan file gagal, minimal log ke stderr agar tidak mematikan flow
    // (hindari melempar error lagi dari logger)
    // eslint-disable-next-line no-console
    console.error("LOG WRITE FAIL:", e?.message || e);
    // sebagai fallback terakhir
    // eslint-disable-next-line no-console
    console.error(line);
  }
}

/* ========== Facade ========== */
export const Log = {
  info: (e: Omit<LogEntry, "level">) => writeLog({ level: "INFO", ...e }),
  warn: (e: Omit<LogEntry, "level">) => writeLog({ level: "WARN", ...e }),
  error: (e: Omit<LogEntry, "level">) => writeLog({ level: "ERROR", ...e }),
};
