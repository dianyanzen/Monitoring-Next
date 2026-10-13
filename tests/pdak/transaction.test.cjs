require("../../scripts/pdak-ts-loader.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parsePdaKFile } = require("../../src/lib/pdak/parser.ts");
const { insertDataset } = require("../../src/lib/pdak/transaction.ts");
// Transactional Oracle double: staged writes, unique locking, commit/rollback.
// These tests verify our transaction protocol, not Oracle availability or actual DDL.
function database() {
  const batches = new Map(),
    rows = new Map(),
    locks = new Map();
  const connection = (failAt = 0) => {
    let key,
      marker,
      pending = [],
      release;
    return {
      async execute(sql, b) {
        const k = (b.b_type || "") + ":" + b.b_date;
        if (sql.startsWith("SELECT COUNT(*) AS N FROM PDAK_UPLOAD_BATCH"))
          return { rows: [{ N: batches.has(k) ? 1 : 0 }] };
        if (sql.startsWith("SELECT COUNT(*)"))
          return {
            rows: [
              {
                N: (rows.get(sql.match(/FROM (\w+)/)[1] + ":" + b.b_date) || [])
                  .length,
              },
            ],
          };
        key = k;
        if (locks.has(k)) await locks.get(k);
        if (batches.has(k))
          throw Object.assign(new Error("unique"), { errorNum: 1 });
        locks.set(
          k,
          new Promise((r) => {
            release = r;
          }),
        );
        marker = { ...b };
        return { rowsAffected: 1, outBinds: { b_id: [batches.size + 1] } };
      },
      async executeMany(sql, data, opts) {
        assert.equal(opts.autoCommit, false);
        assert.equal(opts.batchErrors, false);
        const table = sql.match(/INTO (\w+)/)[1];
        for (const [i, row] of data.entries()) {
          pending.push({ table, row });
          if (i + 1 === failAt) throw new Error("simulated row failure");
        }
        return { rowsAffected: data.length };
      },
      async commit() {
        batches.set(key, marker);
        for (const p of pending) {
          const k = p.table + ":" + p.row.TANGGAL_ENTRY;
          rows.set(k, [...(rows.get(k) || []), p.row]);
        }
        locks.delete(key);
        release?.();
      },
      async rollback() {
        pending = [];
        if (release) {
          locks.delete(key);
          release();
        }
      },
    };
  };
  return { connection, batches, rows };
}
async function upload(db, d, date = "2026-10-13", failAt = 0) {
  const conn = db.connection(failAt);
  try {
    await insertDataset(conn, d, date, "staff", "source.xls", "a".repeat(64));
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  }
}
const read = (f) =>
  parsePdaKFile(fs.readFileSync(path.join(__dirname, "fixtures", f)));
test("four categories commit 728 rows and four markers", async () => {
  const db = database();
  for (const f of [
    "KIA.xls",
    "Akta Kelahiran.xls",
    "Target Perekaman.xls",
    "Capaian Target Aktivasi Identitas Kependudukan Digital.xls",
  ])
    await upload(db, await read(f));
  assert.equal(db.batches.size, 4);
  assert.equal([...db.rows.values()].flat().length, 728);
});
test("same category daily duplicate blocked, other category allowed", async () => {
  const db = database(),
    d = await read("KIA.xls");
  await upload(db, d);
  await assert.rejects(upload(db, d), (e) => e.code === "REJECTED_DUPLICATE");
  await upload(db, await read("Akta Kelahiran.xls"));
  assert.equal(db.batches.size, 2);
});
test("two concurrent uploads produce exactly one commit", async () => {
  const db = database(),
    d = await read("KIA.xls");
  const results = await Promise.allSettled([upload(db, d), upload(db, d)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(db.batches.size, 1);
  assert.equal([...db.rows.values()].flat().length, 182);
});
test("row 100 failure rolls back marker and all rows; retry succeeds", async () => {
  const db = database(),
    d = await read("KIA.xls");
  await assert.rejects(upload(db, d, "2026-10-13", 100));
  assert.equal(db.rows.size, 0);
  assert.equal(db.batches.size, 0);
  await upload(db, d);
  assert.equal(db.batches.size, 1);
});
test("legacy data without batch blocks upload", async () => {
  const db = database(),
    d = await read("KIA.xls");
  db.rows.set("PDAK_KIA:2026-10-13", [d.rows[0]]);
  await assert.rejects(
    upload(db, d),
    (e) => e.code === "LEGACY_RECONCILIATION_REQUIRED",
  );
  assert.equal(db.batches.size, 0);
  assert.equal(db.rows.get("PDAK_KIA:2026-10-13").length, 1);
});
test("next day preserves yesterday snapshot", async () => {
  const db = database(),
    d = await read("KIA.xls");
  await upload(db, d);
  await upload(db, d, "2026-10-14");
  assert.equal(db.batches.size, 2);
  assert.equal(db.rows.get("PDAK_KIA:2026-10-13").length, 182);
  assert.equal(db.rows.get("PDAK_KIA:2026-10-14").length, 182);
});
