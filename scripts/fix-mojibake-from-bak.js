const fs = require('fs');
const path = require('path');

const bak = path.resolve(process.cwd(), 'README.md.bak');
const out = path.resolve(process.cwd(), 'README.md');

if (!fs.existsSync(bak)) {
  console.error('README.md.bak not found.');
  process.exit(1);
}

let s = fs.readFileSync(bak, 'utf8');

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

for (const [k,v] of Object.entries(map)) {
  s = s.split(k).join(v);
}

s = s.replace(/\u00A0/g, ' ');
s = s.replace(/\s{3,}/g, '  ');

fs.writeFileSync(out, s, 'utf8');
console.log('Wrote cleaned README.md (UTF-8). Backup preserved as README.md.bak');
