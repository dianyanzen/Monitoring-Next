// One-off, explicit mapping verification against supplied fixtures and DDL.
require("./pdak-ts-loader.cjs");
const fs = require("node:fs");
const { DATASETS } = require("../src/lib/pdak/config.ts");
const files = [
  "KIA.xls",
  "Akta Kelahiran.xls",
  "Target Perekaman.xls",
  "Capaian Target Aktivasi Identitas Kependudukan Digital.xls",
];
const ddl = fs.readFileSync(
  "tests/pdak/fixtures/PDAK_01_CREATE_TABLES.sql",
  "utf8",
);
let config = fs.readFileSync("src/lib/pdak/config.ts", "utf8");
for (let i = 0; i < DATASETS.length; i++) {
  const dataset = DATASETS[i];
  const html = fs.readFileSync("tests/pdak/fixtures/" + files[i], "utf8");
  const headers = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) =>
    m[1].trim().replace(/\s+/g, " "),
  );
  if (headers.length !== dataset.fields.length)
    throw new Error(dataset.type + ": column count mismatch");
  const section = ddl
    .split("CREATE TABLE " + dataset.table + " (")[1]
    ?.split("\n);")[0];
  for (let j = 0; j < headers.length; j++) {
    const field = dataset.fields[j];
    if (
      !new RegExp("\\b" + field.column + "\\s+(NUMBER|VARCHAR2)").test(
        section || "",
      )
    )
      throw new Error("DDL mismatch: " + field.column);
    if (j >= 3)
      config = config.replace(
        `{ header: ${JSON.stringify(field.header)}, column: ${JSON.stringify(field.column)} }`,
        `{ header: ${JSON.stringify(headers[j])}, column: ${JSON.stringify(field.column)} }`,
      );
  }
  console.log(
    `${dataset.type}: ${headers.length} headers and ${headers.length + 4} DDL columns verified`,
  );
}
fs.writeFileSync("src/lib/pdak/config.ts", config);
