const fs = require('fs');
const path = require('path');

const infile = path.resolve(process.cwd(), 'README.md');
const outfile = path.resolve(process.cwd(), 'README.fixed.md');
const bak = path.resolve(process.cwd(), 'README.md.bak');

if (!fs.existsSync(infile)) {
  console.error('README.md not found in repo root.');
  process.exit(1);
}

let s = fs.readFileSync(infile, 'utf8');

const map = {
  'ΓÇö': '—',
  'ΓÇ£': '“',
  'ΓÇ¥': '”',
  'ΓåÆ': ' — ',
  'ΓÜá∩╕Å': '',
  'ΓëÑ': '≈',
  'Γö£': '-',
  'Γöé': ' ',
  'Γöö': ' ',
  'ΓöÇ': '',
  'ΓÜÖ∩╕Å': '',
  'Γ£à': '(✓)',
  'Γ£ì': '',
  'ΓÜÇ': '—',
  'ΓÜí': '',
  'ΓÜï': ''
};

for (const [k, v] of Object.entries(map)) {
  s = s.split(k).join(v);
}

// normalize multiple spaces and NBSP
s = s.replace(/\u00A0/g, ' ');
s = s.replace(/\s{3,}/g, '  ');

// Backup original then write fixed
fs.copyFileSync(infile, bak);
fs.writeFileSync(outfile, s, 'utf8');
console.log('Wrote', outfile, 'and backup saved as README.md.bak');
