require("../../scripts/pdak-ts-loader.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  parsePdaKFile,
  MAX_FILE_BYTES,
} = require("../../src/lib/pdak/parser.ts");
const { getPdakEntryDate } = require("../../src/lib/pdak/date.ts");
const fixtures = path.join(__dirname, "fixtures");
const kia = fs.readFileSync(path.join(fixtures, "KIA.xls"), "utf8");
for (const [file, type, n] of [
  ["KIA.xls", "KIA", 50],
  ["Akta Kelahiran.xls", "AKTA_KELAHIRAN", 50],
  ["Target Perekaman.xls", "PEREKAMAN_KTPL", 22],
  ["Capaian Target Aktivasi Identitas Kependudukan Digital.xls", "IKD", 6],
]) {
  test("original HTML fixture: " + type, async () => {
    const d = await parsePdaKFile(fs.readFileSync(path.join(fixtures, file)));
    assert.equal(d.config.type, type);
    assert.equal(d.config.fields.length, n);
    assert.equal(d.rows.length, 182);
    assert.equal(new Set(d.rows.map((r) => r.KODE)).size, 182);
  });
}
test("preserves leading zeros, zero and percentage units", async () => {
  const d = await parsePdaKFile(Buffer.from(kia));
  assert.equal(d.rows[1].KODE, "32.73.01");
  assert.equal(d.rows[0].PERSEN_DINAMIS_PERSEN, 71.6);
  assert.equal(d.rows[0].NONAKTIF_LK, 0);
});
test("renamed file identified by contents", async () => {
  assert.equal((await parsePdaKFile(Buffer.from(kia))).config.type, "KIA");
});
for (const [name, html] of [
  ["unexpected header", kia.replace("</th></tr>", "</th><th>EXTRA</th></tr>")],
  ["missing header", kia.replace("<th>NO</th>", "")],
  ["changed header", kia.replace("JUMLAH AWAL (LK)", "JUMLAH AWAL LK")],
  ["duplicate header", kia.replace("<th>KODE</th>", "<th>NO</th>")],
  ["duplicate code", kia.replace("32.73.01.1001", "32.73.01")],
  ["missing parent", kia.replace("32.73.01.1001", "32.73.99.1001")],
  ["script", kia.replace("<body>", "<body><script>alert(1)</script>")],
  ["active attributes", kia.replace("<body>", '<body onload="x()">')],
  ["corrupt number", kia.replace("335417", "1.2.3")],
  ["percentage exceeds range", kia.replace("71.6", "171.6")],
  ["fractional count", kia.replace("335417", "335417.4")],
  [
    "extra data column",
    kia.replace(
      '<td align="center">1</td>',
      '<td>extra</td><td align="center">1</td>',
    ),
  ],
])
  test("rejects " + name, async () =>
    assert.rejects(parsePdaKFile(Buffer.from(html))),
  );
test("rejects oversized, corrupt OLE and ZIP", async () => {
  for (const b of [
    Buffer.alloc(MAX_FILE_BYTES + 1),
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.from([0x50, 0x4b, 3, 4, 1]),
  ])
    await assert.rejects(parsePdaKFile(b));
});
test("date follows Jakarta midnight regardless of host timezone", () => {
  assert.equal(
    getPdakEntryDate(new Date("2026-10-13T16:59:59Z")),
    "2026-10-13",
  );
  assert.equal(
    getPdakEntryDate(new Date("2026-10-13T17:00:00Z")),
    "2026-10-14",
  );
});
test("real OOXML workbook preserves numeric percentages; formulas rejected", async () => {
  const ExcelJS = require("exceljs");
  const d = await parsePdaKFile(Buffer.from(kia));
  const wb = new ExcelJS.Workbook(),
    sheet = wb.addWorksheet("PDAK");
  sheet.addRow(d.config.fields.map((f) => f.header));
  for (const row of d.rows)
    sheet.addRow(d.config.fields.map((f) => row[f.column]));
  let data = Buffer.from(await wb.xlsx.writeBuffer());
  const parsed = await parsePdaKFile(data);
  assert.equal(parsed.rows[0].PERSEN_DINAMIS_PERSEN, 71.6);
  sheet.getCell(2, 47).value = 9.7;
  data = Buffer.from(await wb.xlsx.writeBuffer());
  assert.equal((await parsePdaKFile(data)).rows[0].PERSEN_DINAMIS_PERSEN, 9.7);
  sheet.getCell(2, 47).value = 171.6;
  await assert.rejects(parsePdaKFile(Buffer.from(await wb.xlsx.writeBuffer())));
  sheet.getCell(2, 47).value = { formula: "1+1", result: 2 };
  await assert.rejects(parsePdaKFile(Buffer.from(await wb.xlsx.writeBuffer())));
});
