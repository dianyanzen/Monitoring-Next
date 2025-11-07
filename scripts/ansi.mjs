// FILE: scripts/ansi.mjs
// ANSI helpers + padding yang sadar ANSI (agar border sejajar)

export const ansi = {
  r: "\x1b[0m",
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  fg: (n, s) => `\x1b[38;5;${n}m${s}\x1b[0m`,
};

export const line = (n, ch = "─") => ch.repeat(Math.max(0, n));

const ANSI_RE = /\x1b\[[0-9;]*m/g;
export const stripAnsi = (s) => String(s).replace(ANSI_RE, "");
export const visLen = (s) => stripAnsi(s).length;

export const padAnsi = (s, width) => {
  const len = visLen(s);
  if (len >= width) return s;
  return s + " ".repeat(width - len);
};

// optional cutter bila butuh memotong string panjang
export const cutAnsi = (s, width) => {
  let out = "", count = 0, i = 0;
  const str = String(s);
  while (i < str.length && count < width) {
    if (str[i] === "\x1b") {
      const m = str.slice(i).match(/^\x1b\[[0-9;]*m/);
      if (m) { out += m[0]; i += m[0].length; continue; }
    }
    out += str[i++]; count++;
  }
  return out + (count < visLen(s) ? ansi.r : "");
};
