// FILE: scripts/pretty-start.mjs
// (tanpa shebang; ESM murni, kompatibel Windows)

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { ansi as c, line, padAnsi, cutAnsi } from "./ansi.mjs";

/* ========= meta ========= */
const PKG = safeJson("./package.json");
const APP = process.env.APP_NAME || "Monalisa Monitoring";
const NODEV = process.version; // v22.x
const NEXTV =
  (PKG.dependencies && PKG.dependencies.next) ||
  (PKG.devDependencies && PKG.devDependencies.next) || "?";

const basePath = normalizeBase(process.env.NEXT_BASEPATH || "/monitoring");
const now = new Date();
const stamp = now.toISOString().replace(/[:T]/g, "-").slice(0, 19);
const logDir = process.env.LOG_DIR || "./log";
safeMkdir(logDir);
const logFile = join(logDir, `start-${stamp}.log`);

/* ========= args ========= */
const dash = process.argv.indexOf("--");
let passthrough = dash > -1 ? process.argv.slice(dash + 1) : [];
if (passthrough[0] === "start") passthrough.shift(); // jaga kalau ada yang terlanjur kirim "start"
const host = getArg(passthrough, "-H", "--hostname") || "0.0.0.0";
const port = +(getArg(passthrough, "-p", "--port") || process.env.PORT || 3000);
const ip = guessIP(host);

/* ========= banner ========= */
console.clear();

const W = 76; // lebar isi box (ubah jika perlu)

const box = (rows) => {
  const tl = "┌", tr = "┐", bl = "└", br = "┘", v = "│";
  const head = `${tl}${line(W)}${tr}`;
  const foot = `${bl}${line(W)}${br}`;
  const body = rows.map((s) => `${v} ${padAnsi(s, W - 1)}${v}`).join("\n");
  return `${head}\n${body}\n${foot}`;
};

const titleRows = [
  padAnsi(` ${c.fg(213, "▞")} ${c.b(APP)}  ${c.dim("(0.0.0.0 win64)")}`, W - 2),
  padAnsi(` ${c.fg(45, "▚")} ${c.dim(`Next ${stripRange(NEXTV)} | Node ${NODEV}`)}`, W - 2),
];
console.log(box(titleRows));

const label = (k, v, col = 81) => `${k.padEnd(5)} : ${c.fg(col, v)}`;

const appPath = cutAnsi(process.cwd().replace(/\\/g, "/"), W - 12);
const logPath = cutAnsi(logFile.replace(/\\/g, "/"), W - 12);

const infoRows = [
  c.b("Listening on"),
  label("ip", ip),
  label("port", String(port)),
  label("host", host),
  "",
  c.b("Process"),
  label("app", appPath),
  label("log", logPath),
  "",
  c.dim("[CTRL+C] untuk menghentikan server"),
];
console.log(box(infoRows));

const url = `http://${ip}:${port}${basePath}`;
println(`${c.fg(120, "[START]")} ${c.fg(81, url)}\n`);

/* ========= run next (tanpa npx) ========= */
const require = createRequire(import.meta.url);
const nextBin = resolveNextBin(require);

const child = spawn(process.execPath, [nextBin, "start", ...passthrough], {
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (b) => { const s = b.toString(); process.stdout.write(s); append(logFile, s); });
child.stderr.on("data", (b) => { const s = b.toString(); process.stderr.write(s); append(logFile, s); });
child.on("close", (code) => { append(logFile, `\n[END] exited ${code} @ ${new Date().toISOString()}\n`); process.exit(code ?? 0); });

/* ========= helpers ========= */
function stripRange(v){ return String(v).replace(/^[\^~]/, ""); }
function println(s){ console.log(s); append(logFile, stripAnsiSoft(s) + "\n"); }
function stripAnsiSoft(s){ return String(s).replace(/\x1b\[[0-9;]*m/g, ""); }
function append(f, s){ try{ writeFileSync(f, s, { flag:"a" }); }catch{} }
function safeMkdir(d){ if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function safeJson(p){ try{ return JSON.parse(readFileSync(p,"utf8")); } catch { return {}; } }
function getArg(arr, short, long){ const i = arr.findIndex(x=>x===short||x===long); return i>-1 ? arr[i+1] : null; }
function normalizeBase(b){ if(!b) return ""; let x=b.startsWith("/")?b:"/"+b; if(x.length>1) x=x.replace(/\/+$/,""); return x; }
function guessIP(h){ if(h && h!=="0.0.0.0") return h; try{ const nets=os.networkInterfaces(); for(const k of Object.keys(nets)){ for(const n of nets[k]||[]){ if(n.family==="IPv4" && !n.internal) return n.address; } } }catch{} return "localhost"; }
function resolveNextBin(req){ try{ return req.resolve("next/dist/bin/next"); } catch { console.error("[ERROR] 'next' tidak ditemukan. jalankan: npm i next"); process.exit(1); } }
