// Integration verification against the normal DB pool. ALL DML IS ROLLED BACK.
// No DDL, menu updates, permanent snapshot, or commit is performed.
require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
// Next handles this build-time marker internally; standalone Node does not.
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "server-only" ? {} : originalLoad.call(this, name, ...args);
};
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { getOracleConnection } = require("../src/lib/oracle.ts");
const {
  checkSchema,
  loadRegionMaster,
  uploadStatus,
  uploadHistory,
} = require("../src/lib/pdak/uploadRepository.ts");
const { insertDataset } = require("../src/lib/pdak/transaction.ts");
const { getPdakEntryDate } = require("../src/lib/pdak/date.ts");
const { parsePdaKFile } = require("../src/lib/pdak/parser.ts");
const { validateHierarchy } = require("../src/lib/pdak/validate.ts");
const { readSnapshot } = require("../src/lib/pdak/snapshots.ts");
(async () => {
  const date = getPdakEntryDate();
  const master = await loadRegionMaster();
  const status = await uploadStatus(date);
  assert.equal(status.length, 4);
  await uploadHistory(20, 0);
  console.log("Schema, master regions, daily status and history queries: PASS");
  const conn = await getOracleConnection("DB");
  conn.callTimeout = 15000;
  try {
    await checkSchema(conn);
    for (const type of ["KIA", "AKTA_KELAHIRAN", "PEREKAMAN_KTPL", "IKD"])
      await readSnapshot(conn, type, null);
    console.log("Latest-date snapshot queries for all four datasets: PASS");
    if (status.some((s) => !s.canUpload)) {
      console.log(
        "DML verification skipped: existing daily snapshot preserved",
      );
      return;
    }
    const datasets = [];
    for (const file of fs
      .readdirSync("tests/pdak/fixtures")
      .filter((f) => f.endsWith(".xls"))) {
      const d = await parsePdaKFile(
        fs.readFileSync("tests/pdak/fixtures/" + file),
      );
      validateHierarchy(d.rows, master);
      datasets.push(d);
      await insertDataset(
        conn,
        d,
        date,
        "PDAK_ROLLBACK_TEST",
        file,
        "0".repeat(64),
      );
      const snapshot=await readSnapshot(conn,d.config.type,date);
      assert.equal(snapshot.date,date);
      assert.equal(snapshot.rows.length,182);
    }
    const staged = await conn.execute(
      "SELECT COUNT(*) AS N FROM PDAK_UPLOAD_BATCH WHERE TANGGAL_ENTRY=TO_DATE(:b_date,'YYYY-MM-DD')",
      { b_date: date },
    );
    assert.equal(staged.rows[0].N, 4);
    await assert.rejects(
      insertDataset(
        conn,
        datasets[0],
        date,
        "PDAK_ROLLBACK_TEST",
        "renamed.xls",
        "1".repeat(64),
      ),
      (e) => e.code === "REJECTED_DUPLICATE",
    );
    console.log('Newly inserted snapshots can be read by their date with all 182 rows: PASS (uncommitted)');
    console.log(
      "Four actual Oracle executeMany inserts, 728 staged rows, 4 markers, duplicate refusal: PASS (uncommitted)",
    );
  } finally {
    await conn.rollback();
    await conn.close();
  }
  const after = await uploadStatus(date);
  assert.equal(after.filter((s) => s.canUpload).length, 4);
  console.log(
    "Rollback verification: all four daily slots remain empty, no residual batch or rows: PASS",
  );
  const failureConn = await getOracleConnection("DB");
  failureConn.callTimeout = 15000;
  try {
    const d = await parsePdaKFile(
      fs.readFileSync("tests/pdak/fixtures/KIA.xls"),
    );
    const invalid = {
      ...d,
      rows: d.rows.map((row, index) =>
        index === 99 ? { ...row, NO: 100000000 } : row,
      ),
    };
    await assert.rejects(
      insertDataset(
        failureConn,
        invalid,
        date,
        "PDAK_ROLLBACK_TEST",
        "failure-100.xls",
        "0".repeat(64),
      ),
      (e) => e.errorNum === 1438,
    );
  } finally {
    await failureConn.rollback();
    await failureConn.close();
  }
  assert.equal((await uploadStatus(date)).filter((s) => s.canUpload).length, 4);
  console.log(
    "Actual Oracle row 100 precision failure: rollback leaves no rows or marker: PASS",
  );
})()
  .catch((e) => {
    console.error("Oracle check failed:", e.code || e.errorNum || e.name);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const pool of globalThis.__ORACLE_POOLS__?.values() || [])
      await pool.close(0);
  });
