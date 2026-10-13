require("./pdak-ts-loader.cjs");
const fs = require("node:fs");
const { DATASETS } = require("../src/lib/pdak/config.ts");
const { parsePdaKFile } = require("../src/lib/pdak/parser.ts");
const { validateHierarchy } = require("../src/lib/pdak/validate.ts");
const raw = fs.readFileSync("logs/pdak-oracle-audit.jsonl");
const audit = raw
  .toString(raw[0] === 255 && raw[1] === 254 ? "utf16le" : "utf8")
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse);
const columns = audit.find((a) => a.name === "columns").rows;
const regions = audit.find((a) => a.name === "regions").rows;
const master = new Map(regions.map((r) => [r.KODE, r.WILAYAH]));
(async () => {
  for (const d of DATASETS) {
    const actual = columns.filter((c) => c.TABLE_NAME === d.table);
    if (
      actual.length !== d.fields.length + 4 ||
      d.fields.some((f) => !actual.find((c) => c.COLUMN_NAME === f.column))
    )
      throw new Error("Oracle mapping mismatch: " + d.type);
    const files = fs
      .readdirSync("tests/pdak/fixtures")
      .filter((f) => f.endsWith(".xls"));
    for (const f of files) {
      const parsed = await parsePdaKFile(
        fs.readFileSync("tests/pdak/fixtures/" + f),
      );
      if (parsed.config.type === d.type) {
        validateHierarchy(parsed.rows, master);
        console.log(
          d.type + ": actual Oracle columns and 182 master regions verified",
        );
      }
    }
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
