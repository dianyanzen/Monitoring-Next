require("./pdak-ts-loader.cjs");
const fs = require("node:fs");
const { parsePdaKFile } = require("../src/lib/pdak/parser.ts");
const b = fs.readFileSync("logs/pdak-oracle-audit.jsonl");
const rows = b
  .toString(b[0] === 255 ? "utf16le" : "utf8")
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse)
  .find((x) => x.name === "regions").rows;
const master = new Map(rows.map((r) => [r.KODE, r.WILAYAH]));
(async () => {
  const d = await parsePdaKFile(fs.readFileSync("tests/pdak/fixtures/KIA.xls"));
  for (const row of d.rows) {
    if (master.get(row.KODE) !== row.WILAYAH)
      console.log(
        JSON.stringify({
          code: row.KODE,
          fixture: row.WILAYAH,
          master: master.get(row.KODE),
        }),
      );
  }
})();
