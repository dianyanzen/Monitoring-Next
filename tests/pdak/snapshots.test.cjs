require("../../scripts/pdak-ts-loader.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  snapshotDate,
  readSnapshot,
} = require("../../src/lib/pdak/snapshots.ts");
test("date validation rejects impossible dates and injection", () => {
  assert.equal(snapshotDate(null), null);
  assert.equal(snapshotDate("2026-10-13"), "2026-10-13");
  for (const date of [
    "2026-02-30",
    "2026-13-01",
    "2026-01-01' OR 1=1",
    "13-10-2026",
  ])
    assert.throws(() => snapshotDate(date));
});
function connection(dates) {
  const queries = [];
  return {
    queries,
    async execute(sql, binds) {
      queries.push({ sql, binds });
      return sql.includes("DISTINCT")
        ? { rows: dates.map((d) => ({ SNAPSHOT_DATE: d })) }
        : { rows: [{ KODE: "32.73", WILAYAH: "KOTA BANDUNG", NO: 1 }] };
    },
  };
}
test("default uses latest stored date, not calendar today", async () => {
  const c = connection(["2026-10-10", "2026-10-09"]);
  const data = await readSnapshot(c, "KIA", null);
  assert.equal(data.date, "2026-10-10");
  assert.equal(c.queries[1].binds.b_date, "2026-10-10");
  assert.match(c.queries[1].sql, /FROM PDAK_KIA/);
});
test("explicit older date is bound; column mapping remains complete", async () => {
  const c = connection(["2026-10-10", "2026-10-09"]);
  const data = await readSnapshot(c, "AKTA_KELAHIRAN", "2026-10-09");
  assert.equal(data.date, "2026-10-09");
  assert.equal(data.fields.length, 50);
  assert.equal(c.queries[1].binds.b_date, "2026-10-09");
  assert.match(c.queries[1].sql, /FROM PDAK_AKTA_KELAHIRAN_04/);
});
test("no snapshots returns empty data and no made-up date", async () => {
  const c = connection([]);
  const data = await readSnapshot(c, "IKD", null);
  assert.equal(data.date, null);
  assert.deepEqual(data.rows, []);
  assert.equal(c.queries.length, 1);
});
test("table names are restricted to known datasets", async () => {
  await assert.rejects(
    readSnapshot(connection([]), "PDAK_KIA;DROP TABLE X", null),
  );
});
