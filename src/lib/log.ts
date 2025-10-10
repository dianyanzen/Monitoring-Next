// FILE: src/lib/log.ts
import { promises as fs } from "fs";
import path from "path";

type LogLevel = "INFO" | "WARN" | "ERROR";
type LogScope = "API" | "DB" | "SESSION" | "MIDDLEWARE" | "SYSTEM" | "ACCOUNT" | "OTHER";

export type LogEntry = {
  level: LogLevel;
  scope: LogScope;
  msg: string;
  at?: string;            // route/path or SQL id/alias
  user?: string;          // S_USER_ID / NIK
  session?: string;       // S_SESSION_ID
  ip?: string;
  ua?: string;
  tookMs?: number;        // duration
  extra?: Record<string, any>; // free-form
  // when relevant:
  sql?: string;
  binds?: Record<string, unknown>;
  err?: { name: string; message: string; stack?: string };
};

function nowParts() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const iso = d.toISOString();
  return { yyyy, mm, dd, iso };
}

function baseLogDir() {
  return process.env.LOG_DIR || path.join(process.cwd(), "logs");
}

export async function writeLog(entry: LogEntry) {
  const { yyyy, mm, dd, iso } = nowParts();
  const dir = path.join(baseLogDir(), `${yyyy}-${mm}`, dd);
  const file = path.join(dir, "log.txt");

  // bentuk baris log ringkas + payload JSON
  const head = `[${iso}] [${entry.level}] [${entry.scope}]`;
  const line = `${head} ${entry.msg} ${JSON.stringify({
    at: entry.at, user: entry.user, session: entry.session,
    ip: entry.ip, ua: entry.ua, tookMs: entry.tookMs,
    sql: entry.sql ? summarizeSql(entry.sql) : undefined,
    binds: entry.binds,
    extra: entry.extra,
    err: entry.err ? { name: entry.err.name, message: entry.err.message } : undefined
  })}\n`;

  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(file, line, "utf8");
}

function summarizeSql(sql: string) {
  const s = sql.replace(/\s+/g, " ").trim();
  return s.length > 500 ? s.slice(0, 500) + " ...[truncated]" : s;
}

// Helper cepat:
export const Log = {
  info: (e: Omit<LogEntry, "level">) => writeLog({ level: "INFO", ...e }),
  warn: (e: Omit<LogEntry, "level">) => writeLog({ level: "WARN", ...e }),
  error:(e: Omit<LogEntry, "level">) => writeLog({ level: "ERROR",...e }),
};
