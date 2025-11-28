// FILE: scripts/pretty-start.mjs
// FINAL HYBRID VERSION — Windows-safe (no ANSI), Linux full ANSI

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

// detect platform
const isWin = process.platform === "win32";
const canColor = !isWin;  // Windows Server = NO ANSI

// dummy color wrapper
const color = {
  bold: (s) => (canColor ? `\x1b[1m${s}\x1b[0m` : s),
  cyan: (s) => (canColor ? `\x1b[36m${s}\x1b[0m` : s),
  pink: (s) => (canColor ? `\x1b[35m${s}\x1b[0m` : s),
};

// FIX: swallow stdout/stderr errors (EIO/EPIPE)
function protectStream(stream) {
  if (!stream || typeof stream.on !== "function") return;
  stream.on("error", (err) => {
    if (!err) return;
    if (err.code === "EIO" || err.code === "EPIPE") return;
    try { console.error("[stream-error]", err.code); } catch {}
  });
}
protectStream(process.stdout);
protectStream(process.stderr);

// small helpers
function safeJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch { return {}; }
}
function append(f, s) {
  try { writeFileSync(f, s, { flag: "a" }); } catch {}
}

// load metadata
const PKG = safeJson("./package.json");
const APP = process.env.APP_NAME || "Monalisa Monitoring";
const NODEV = process.version;
const NEXTV = PKG.dependencies?.next || PKG.devDependencies?.next || "?";

const basePath = process.env.NEXT_BASEPATH || "/monitoring";
const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const logDir = process.env.LOG_DIR || "./log";
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
const logFile = join(logDir, `start-${stamp}.log`);

// get args
const dash = process.argv.indexOf("--");
let passthrough = dash > -1 ? process.argv.slice(dash + 1) : [];
if (passthrough[0] === "start") passthrough.shift();

const host = passthrough.includes("-H") ? passthrough[passthrough.indexOf("-H")+1] : "0.0.0.0";
const port = +(passthrough.includes("-p") ? passthrough[passthrough.indexOf("-p")+1] : process.env.PORT || 3000);

// guess IP
function guessIP() {
  if (host !== "0.0.0.0") return host;
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (n.family === "IPv4" && !n.internal) return n.address;
      }
    }
  } catch {}
  return "localhost";
}
const ip = guessIP();

// CLEAR SCREEN
try { console.clear(); } catch {}

// ========================
// WINDOWS HEADER (simple)
// ========================
if (isWin) {
  console.log("=========================================");
  console.log(`  ${APP}`);
  console.log(`  Next.js ${NEXTV} | Node ${NODEV}`);
  console.log("=========================================");
  console.log(`IP     : ${ip}`);
  console.log(`PORT   : ${port}`);
  console.log(`HOST   : ${host}`);
  console.log(`LOG    : ${logFile}`);
  console.log("-----------------------------------------");
  console.log("CTRL + C untuk menghentikan server");
  console.log("");
} 
// ========================
// LINUX HEADER (ANSI)
// ========================
else {
  console.log(color.cyan("┌─────────────────────────────────────────────┐"));
  console.log(color.cyan(`│  ${color.bold(APP)}  │`));
  console.log(color.cyan(`│  Next ${NEXTV} | Node ${NODEV}               │`));
  console.log(color.cyan("└─────────────────────────────────────────────┘"));
  console.log(color.bold("IP: ") + ip);
  console.log(color.bold("PORT: ") + port);
  console.log(color.bold("HOST: ") + host);
  console.log(color.bold("LOG: ") + logFile);
  console.log("");
}

const url = `http://${ip}:${port}${basePath}`;
console.log("START:", url);
append(logFile, `START ${url}\n`);

// run next
const require = createRequire(import.meta.url);
function resolveNextBin(r) {
  try { return r.resolve("next/dist/bin/next"); }
  catch {
    console.error("[ERROR] next tidak ditemukan.");
    process.exit(1);
  }
}
const nextBin = resolveNextBin(require);

const child = spawn(process.execPath, [nextBin, "start", ...passthrough], {
  stdio: ["inherit", "pipe", "pipe"],
});

protectStream(child.stdout);
protectStream(child.stderr);

child.stdout.on("data", (b) => {
  const s = b.toString();
  try { process.stdout.write(s); } catch {}
  append(logFile, s);
});

child.stderr.on("data", (b) => {
  const s = b.toString();
  try { process.stderr.write(s); } catch {}
  append(logFile, s);
});

child.on("close", (code) => {
  append(logFile, `EXIT ${code}\n`);
  process.exit(code ?? 0);
});
