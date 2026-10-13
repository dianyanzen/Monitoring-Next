const test = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
require("../../scripts/pdak-ts-loader.cjs");
const {
  capaianRow,
  CAPAIAN_SOURCES,
} = require("../../src/lib/dashboard/capaian.ts");
const {
  number,
  text,
  range,
  stockDelta,
  csvCell,
} = require("../../src/lib/barang/validation.ts");
const { allowed } = require("../../src/lib/barang/navigation.ts");
const { safeRichText, escapeHtml } = require("../../src/lib/safeHtml.ts");
const { verifyEdgeSession } = require("../../src/lib/sessionEdge.ts");
test("capaian uses PDAK real counts, stored coverage and permits progress above 100", () => {
  const r = capaianRow(
    CAPAIAN_SOURCES[0],
    {
      REALISASI: 120,
      COVERAGE: 85,
      SNAPSHOT_DATE: "2026-10-13",
      DENOMINATOR: 140,
    },
    { TARGET_REKAM_R: 100, TARGET_REKAM_P: 99 },
  );
  assert.equal(r.progress, 120);
  assert.equal(r.coverage, 85);
  assert.equal(r.realisasi, 120);
});
test("missing snapshot is N/A, not old configured realization or fabricated zero", () => {
  const r = capaianRow(CAPAIAN_SOURCES[1], undefined, {
    CAPAIAN_KIA_R: 99,
    TARGET_KIA_R: 100,
  });
  assert.equal(r.realisasi, null);
  assert.equal(r.progress, null);
  assert.equal(r.date, null);
});
test("zero denominator target and invalid coverage remain N/A", () => {
  const r = capaianRow(
    CAPAIAN_SOURCES[2],
    { REALISASI: 0, COVERAGE: 101 },
    { TARGET_AKTE_LHR_R: 0 },
  );
  assert.equal(r.progress, null);
  assert.equal(r.coverage, null);
  assert.equal(r.realisasi, 0);
  assert.match(r.title, /0–4/);
});
test("inventory rejects invalid quantities and unsafe identifiers", () => {
  for (const v of [-1, 0, NaN, Infinity, "bad", null, true, {}])
    assert.throws(() => number(v, "Jumlah"));
  assert.throws(() => number(1.5, "ID", true, true));
  assert.equal(number("2.5", "Jumlah"), 2.5);
  assert.equal(number(0, "Harga", false), 0);
});
test("inventory validates byte limits and control characters", () => {
  assert.throws(() => text("é".repeat(30), "Nama", 50));
  assert.throws(() => text("a\u0000b", "Nama", 50));
  assert.equal(text(" catatan ", "Catatan", 30), "catatan");
  assert.equal(text("", "Catatan", 30, false), "");
});
test("report date parsing handles legacy and ISO and leap years", () => {
  assert.deepEqual(range({ tanggal: "01-10-2026 - 13-10-2026" }), {
    start: "2026-10-01",
    end: "2026-10-13",
  });
  assert.deepEqual(range({ start: "2024-02-29", end: "2024-03-01" }), {
    start: "2024-02-29",
    end: "2024-03-01",
  });
  for (const b of [
    { start: "31-02-2026", end: "01-03-2026" },
    { start: "2026-10-14", end: "2026-10-13" },
    { start: "0000-01-01", end: "0000-01-02" },
  ])
    assert.throws(() => range(b));
});
test("stock mutation delta handles incoming removal and item reassignment", () => {
  assert.equal(stockDelta("masuk", "delete", 10, 0), -10);
  assert.equal(stockDelta("keluar", "update", 5, 2), 3);
  assert.equal(stockDelta("keluar", "update", 0, 5), -5);
  assert.equal(stockDelta("keluar", "update", 5, 0), 5);
});
test("CSV escapes formulas and delimiters; React text helpers escape HTML", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(
    escapeHtml('<img onerror="bad">'),
    "&lt;img onerror=&quot;bad&quot;&gt;",
  );
  const html = safeRichText(
    "<b>OK</b><br><img src=x onerror=bad><script>x</script>",
  );
  assert.ok(html.startsWith("<b>OK</b><br>"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script>"));
});
test("permission matches actual legacy menu paths without granting unrelated CRUD", () => {
  assert.ok(allowed(["barang/inputmasuk"], "masuk"));
  assert.equal(allowed(["barang/cekbarang"], "masuk"), false);
  assert.equal(allowed([], "master"), false);
});
test("Edge session verification matches Node HMAC and rejects tampering", async () => {
  const raw = encodeURIComponent(
    JSON.stringify({
      S_USER_ID: "test",
      S_SESSION_ID: "session",
      S_USER_LEVEL: 5,
    }),
  );
  const secret = "unit-test-only";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("base64url");
  assert.equal(
    (await verifyEdgeSession(raw, signature, secret)).S_USER_LEVEL,
    5,
  );
  assert.equal(await verifyEdgeSession(raw + "x", signature, secret), null);
  assert.equal(await verifyEdgeSession(raw, signature + "x", secret), null);
  assert.equal(await verifyEdgeSession(raw, undefined, secret), null);
});
