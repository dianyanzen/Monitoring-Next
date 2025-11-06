#!/usr/bin/env node
// scripts/fix-readme.js
// Backup README.md, apply conservative mojibake replacements, write README.fixed.md and overwrite README.md as UTF-8.

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const infile = path.join(root, 'README.md');
const backup = path.join(root, 'README.md.bak');
const outfile = path.join(root, 'README.fixed.md');

if (!fs.existsSync(infile)) {
  console.error('README.md not found in repo root:', infile);
  process.exit(2);
}

// create a safe backup (if README.md.bak doesn't exist, create it; otherwise create timestamped)
try {
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(infile, backup);
    console.log('Created backup:', backup);
  } else {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const alt = path.join(root, `README.md.bak.${ts}`);
    fs.copyFileSync(infile, alt);
    console.log('Created timestamped backup:', alt);
  }
} catch (e) {
  console.error('Failed to create backup:', e);
  process.exit(3);
}

// read raw buffer first so we can detect BOM/UTF-16
const buf = fs.readFileSync(infile);
let s = null;

// detect BOM
if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
  // UTF-16 BE
  s = buf.toString('utf16be');
  console.log('Detected BOM: UTF-16 BE');
} else if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
  // UTF-16 LE
  s = buf.toString('utf16le');
  console.log('Detected BOM: UTF-16 LE');
} else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
  // UTF-8 BOM
  s = buf.toString('utf8');
  console.log('Detected BOM: UTF-8');
} else {
  // try utf8 first
  s = buf.toString('utf8');
  // heuristic: if there are many null bytes, treat as utf16le
  const nullCount = (buf.filter(b => b === 0x00).length);
  if (nullCount > buf.length * 0.2) {
    s = buf.toString('utf16le');
    console.log('Heuristic: raw file looks like UTF-16 LE (many null bytes) — decoding as utf16le');
  }
}

// conservative mapping of common mojibake sequences seen in the repo
const map = {
  'ΓÇö': '—',
  'â€“': '–',
  'â€”': '—',
  'â€˜': '‘',
  'â€™': '’',
  'â€œ': '“',
  'â€': '”',
  'â€¢': '•',
  'â€¦': '…',
  'Ã©': 'é',
  'Ã¨': 'è',
  'Ãª': 'ê',
  'Ã¢': 'â',
  'Ã¶': 'ö',
  'Ã¼': 'ü',
  'Ã ': 'à',
  'Ã‚': 'Â',
  'Ãƒ': 'Ã',
  'Ã–': 'Ö',
  'Ãœ': 'Ü',
  'â‚¬': '€',
  'ΓÇ£': '“',
  'ΓÇ¥': '”',
  'ΓåÆ': '→',
  'ΓÜå': '',
  'ΓÜá∩╕Å': '',
  'ΓëÑ': '≈',
  'Â ': ' ',
  '\u00A0': ' '
};

// Apply replacements
for (const [k, v] of Object.entries(map)) {
  s = s.split(k).join(v);
}

// second-pass: common artifacts observed after UTF-16→UTF-8 conversion
const map2 = {
  '਍ഀ': '\r\n', // odd paired glyph sequence seen in file -> newline
  '뿯ν뿯½뿯½': ' ',
  '뿯ν뿯½': ' ',
  '뿯ƽ뿯½뿯½': ' ',
  '뿯ƽ': ' ',
  '∩╕': '',
  '\uFFFD': '', // replacement char
};
for (const [k, v] of Object.entries(map2)) {
  s = s.split(k).join(v);
}

// collapse runs of more than 3 spaces into two, and normalize CRLF to LF then back to CRLF for windows-friendly file
s = s.replace(/\r\n?/g, '\n');
// trim trailing spaces on lines
s = s.split('\n').map(l => l.replace(/[ \t]+$/,'')).join('\n');
// collapse excessive blank lines (more than 2)
s = s.replace(/\n{3,}/g, '\n\n');
// convert back to CRLF for Windows editors
s = s.replace(/\n/g, '\r\n');

// write fixed file
fs.writeFileSync(outfile, s, { encoding: 'utf8' });
console.log('Wrote', outfile);

// overwrite README.md with fixed content (UTF-8, no BOM)
fs.writeFileSync(infile, s, { encoding: 'utf8' });
console.log('Overwrote', infile, 'with cleaned UTF-8 content');

console.log('Done. Please review README.fixed.md and README.md.');
