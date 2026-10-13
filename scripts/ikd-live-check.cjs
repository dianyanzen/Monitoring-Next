// Oracle verification: temporary test snapshots always roll back. No ranking DDL or commit.
require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
const Module = require("node:module"),
  original = Module._load;
Module._load = function (n, ...args) {
  return n === "server-only" ? {} : original.call(this, n, ...args);
};
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { getOracleConnection } = require("../src/lib/oracle.ts");
const {
  loadRegionMaster,
  checkSchema,
} = require("../src/lib/pdak/uploadRepository.ts");
const { parsePdaKFile } = require("../src/lib/pdak/parser.ts");
const { insertDataset } = require("../src/lib/pdak/transaction.ts");
const { rankRows } = require("../src/lib/pdak/ikd/analytics.ts");
const {
  snapshotsOnConnection,
  analysisOnConnection,
  profileOnConnection,
} = require("../src/lib/pdak/ikd/repository.ts");
(async () => {
  const master = await loadRegionMaster(),
    reference = [...master.keys()],
    conn = await getOracleConnection("DB");
  conn.callTimeout = 15000;
  try {
    await checkSchema(conn);
    const fixture = await parsePdaKFile(
      fs.readFileSync(
        "tests/pdak/fixtures/Capaian Target Aktivasi Identitas Kependudukan Digital.xls",
      ),
    );
    const a = "1900-01-01",
      b = "1900-01-08";
    const rowsB = fixture.rows.map((r) => ({
      ...r,
      JUMLAH_IKD: Number(r.JUMLAH_IKD) + 10,
      PERSEN_IKD: Math.min(100, Number(r.PERSEN_IKD) + 1),
    }));
    await insertDataset(
      conn,
      fixture,
      a,
      "IKD_ROLLBACK_TEST",
      "ikd-a.xls",
      "0".repeat(64),
    );
    await insertDataset(
      conn,
      { ...fixture, rows: rowsB },
      b,
      "IKD_ROLLBACK_TEST",
      "ikd-b.xls",
      "1".repeat(64),
    );
    const context = await snapshotsOnConnection(conn, reference);
    for (const date of [a, b])
      assert.ok(context.snapshots.find((s) => s.date === date)?.complete);
    const result = await analysisOnConnection(
      conn,
      { level: "village", league: "ALL", dateA: a, dateB: b },
      context,
    );
    assert.equal(result.rows.length, 151);
    assert.equal(result.comparable, true);
    assert.equal(result.days, 7);
    assert.ok(result.rows.every((r) => r.ikdAdded === 10));
    const districts = await analysisOnConnection(
      conn,
      { level: "district", league: "ALL", dateA: a, dateB: b },
      context,
    );
    assert.equal(districts.rows.length, 30);
    const profile = await profileOnConnection(
      conn,
      "32.73.01.1001",
      b,
      reference,
      master.get("32.73.01.1001"),
    );
    assert.equal(profile.points.length, 2);
    assert.equal(
      profile.currentRank,
      result.rows.find((r) => r.code === "32.73.01.1001").rank,
    );
    console.log(
      "Actual Oracle snapshots, district/village comparison, deltas, city and profile RANK SQL: PASS",
    );
    const incomplete = "1900-01-09";
    // A deliberately partial import is isolated in the same uncommitted transaction.
    await conn.execute(
      "INSERT INTO PDAK_IKD (NO,KODE,WILAYAH,REKAM_DINAMIS,JUMLAH_IKD,PERSEN_IKD,TANGGAL_ENTRY,INSERTED_BY,SOURCE_FILE) VALUES(1,:b_code,:b_name,10000,1000,10,TO_DATE(:b_date,'YYYY-MM-DD'),'IKD_ROLLBACK_TEST','partial.xls')",
      {
        b_code: "32.73.01.1001",
        b_name: master.get("32.73.01.1001"),
        b_date: incomplete,
      },
      { autoCommit: false },
    );
    const partial = await analysisOnConnection(
      conn,
      { level: "village", league: "ALL", dateA: b, dateB: incomplete },
      await snapshotsOnConnection(conn, reference),
    );
    assert.equal(partial.comparable, false);
    assert.equal(partial.rows[0].rankChange, null);
    assert.equal(partial.highlights.biggestClimber, null);
    console.log(
      "Actual incomplete snapshot blocks rank movement and comparative highlights: PASS",
    );
  } finally {
    await conn.rollback();
    await conn.close();
  }
  const verify = await getOracleConnection("DB");
  try {
    const r = await verify.execute(
      "SELECT COUNT(*) AS N FROM PDAK_IKD WHERE TANGGAL_ENTRY BETWEEN TO_DATE('1900-01-01','YYYY-MM-DD') AND TO_DATE('1900-01-09','YYYY-MM-DD')",
    );
    assert.equal(r.rows[0].N, 0);
    const markers = await verify.execute(
      "SELECT COUNT(*) AS N FROM PDAK_UPLOAD_BATCH WHERE DATASET_TYPE='IKD' AND TANGGAL_ENTRY BETWEEN TO_DATE('1900-01-01','YYYY-MM-DD') AND TO_DATE('1900-01-09','YYYY-MM-DD')",
    );
    assert.equal(markers.rows[0].N, 0);
    console.log("All test rows and batch markers rolled back: PASS");
  } finally {
    await verify.close();
  }
})()
  .catch((e) => {
    console.error(
      "IKD Oracle verification failed:",
      e.code || e.errorNum || e.message,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const pool of globalThis.__ORACLE_POOLS__?.values() || [])
      await pool.close(0);
  });
