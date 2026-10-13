require("../../scripts/pdak-ts-loader.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { parsePdaKFile } = require("../../src/lib/pdak/parser.ts");
const {
  compareSnapshots,
  rankRows,
  sizeLeague,
  highlights,
  profileHistory,
  calendarDays,
} = require("../../src/lib/pdak/ikd/analytics.ts");
async function fixture(date = "2026-10-13") {
  const d = await parsePdaKFile(
    fs.readFileSync(
      "tests/pdak/fixtures/Capaian Target Aktivasi Identitas Kependudukan Digital.xls",
    ),
  );
  return d.rows.map((r) => ({
    date,
    code: r.KODE,
    name: r.WILAYAH,
    rekam: r.REKAM_DINAMIS,
    ikd: r.JUMLAH_IKD,
    coverage: r.PERSEN_IKD,
  }));
}
const row = (
  code,
  coverage,
  ikd = 100,
  rekam = 12000,
  date = "2026-10-13",
) => ({ code, name: code, coverage, ikd, rekam, date });
test("city excluded, village and district ranking independent", () => {
  const rows = [
    row("32.73", 99),
    row("32.73.01", 50),
    row("32.73.02", 60),
    row("32.73.01.1001", 8),
    row("32.73.01.1002", 10),
  ];
  assert.deepEqual(
    rankRows(rows, "district").map((r) => [r.code, r.rank]),
    [
      ["32.73.02", 1],
      ["32.73.01", 2],
    ],
  );
  assert.equal(rankRows(rows, "village").length, 2);
});
test("coverage ties have competition ranks 1,1,3; stable code ordering", () => {
  const rows = [
    row("32.73.01.1002", 10, 999),
    row("32.73.01.1001", 10, 2),
    row("32.73.01.1003", 8),
  ];
  assert.deepEqual(
    rankRows(rows, "village").map((r) => [r.code, r.rank]),
    [
      ["32.73.01.1001", 1],
      ["32.73.01.1002", 1],
      ["32.73.01.1003", 3],
    ],
  );
});
test("invalid/null percentage gets N/A, not zero and not a rank", () => {
  assert.equal(rankRows([row("32.73.01.1001", null)], "village")[0].rank, null);
  assert.equal(rankRows([row("32.73.01.1001", 0)], "village")[0].rank, 1);
});
test("league exact boundaries and unknown values", () => {
  for (const [value, league] of [
    [0, "SMALL"],
    [10000, "SMALL"],
    [10001, "MEDIUM"],
    [14999, "MEDIUM"],
    [15000, "LARGE"],
    [null, "UNKNOWN"],
    [-1, "UNKNOWN"],
  ])
    assert.equal(sizeLeague(value), league);
});
test("example 960 to 1210 gives +250, +2 pp, 26.0417%, calendar velocity", async () => {
  const a = await fixture("2026-10-01"),
    b = a.map((r) => ({ ...r, date: "2026-10-06" })),
    code = "32.73.01.1001";
  Object.assign(
    a.find((r) => r.code === code),
    { ikd: 960, coverage: 8 },
  );
  Object.assign(
    b.find((r) => r.code === code),
    { ikd: 1210, coverage: 10 },
  );
  const x = compareSnapshots(
    a,
    b,
    "village",
    a.map((r) => r.code),
    "2026-10-01",
    "2026-10-06",
  ).rows.find((r) => r.code === code);
  assert.equal(x.ikdAdded, 250);
  assert.equal(x.coverageAdded, 2);
  assert.ok(Math.abs(x.growth - 26.0416666667) < 1e-8);
  assert.equal(x.velocity, 50);
});
test("joins by code despite renamed/reordered data", async () => {
  const a = await fixture(),
    b = a
      .map((r) => ({
        ...r,
        name: "RENAMED " + r.name,
        date: "2026-10-14",
        ikd: r.ikd + 1,
      }))
      .reverse();
  const result = compareSnapshots(
    a,
    b,
    "village",
    a.map((r) => r.code),
    "2026-10-13",
    "2026-10-14",
  );
  assert.equal(result.comparable, true);
  assert.ok(result.rows.every((r) => r.ikdAdded === 1 && r.rankChange === 0));
});
test("zero baseline yields New Baseline and null growth", async () => {
  const a = await fixture(),
    b = a.map((r) => ({ ...r, date: "2026-10-14" }));
  const code = "32.73.01.1001";
  a.find((r) => r.code === code).ikd = 0;
  b.find((r) => r.code === code).ikd = 10;
  const r = compareSnapshots(
    a,
    b,
    "village",
    a.map((r) => r.code),
    "2026-10-13",
    "2026-10-14",
  ).rows.find((r) => r.code === code);
  assert.equal(r.growth, null);
  assert.equal(r.baselineStatus, "NEW_BASELINE");
  assert.equal(r.ikdAdded, 10);
});
test("single snapshot ranks current regions but disables comparison/highlights", async () => {
  const b = await fixture();
  const r = compareSnapshots(
    [],
    b,
    "village",
    b.map((x) => x.code),
    null,
    "2026-10-13",
  );
  assert.equal(r.rows.length, 151);
  assert.equal(r.comparable, false);
  assert.ok(r.rows.every((x) => x.rankChange === null && x.growth === null));
  assert.equal(highlights(r.rows, false).biggestClimber, null);
  assert.ok(highlights(r.rows, false).topRanked);
});
test("missing region prevents false climbers but paired deltas still labeled", async () => {
  const a = await fixture(),
    b = a
      .slice(0, -1)
      .map((r) => ({ ...r, date: "2026-10-14", ikd: r.ikd + 3 }));
  const r = compareSnapshots(
    a,
    b,
    "village",
    a.map((x) => x.code),
    "2026-10-13",
    "2026-10-14",
  );
  assert.equal(r.comparable, false);
  assert.ok(r.rows.every((x) => x.rankChange === null && x.ikdAdded === 3));
  assert.equal(highlights(r.rows, false).mostAdded, null);
  assert.equal(r.qualityB.missing.length, 1);
});
test("wrong reference code or null coverage blocks movement", async () => {
  const a = await fixture(),
    b = a.map((r) => ({ ...r, date: "2026-10-14" }));
  b[2].coverage = null;
  assert.equal(
    compareSnapshots(
      a,
      b,
      "village",
      a.map((r) => r.code),
      "2026-10-13",
      "2026-10-14",
    ).comparable,
    false,
  );
  b[2].coverage = 10;
  b[2].code = "32.73.99.9999";
  assert.equal(
    compareSnapshots(
      a,
      b,
      "village",
      a.map((r) => r.code),
      "2026-10-13",
      "2026-10-14",
    ).comparable,
    false,
  );
});
test("league cohort is frozen at B even when population crosses threshold", async () => {
  const a = await fixture(),
    b = a.map((r) => ({ ...r, date: "2026-10-14" }));
  const code = "32.73.01.1001";
  Object.assign(
    a.find((r) => r.code === code),
    { rekam: 9999, coverage: 100 },
  );
  Object.assign(
    b.find((r) => r.code === code),
    { rekam: 10001, coverage: 100 },
  );
  const r = compareSnapshots(
    a,
    b,
    "village",
    a.map((x) => x.code),
    "2026-10-13",
    "2026-10-14",
  ).rows.find((r) => r.code === code);
  assert.equal(r.league, "MEDIUM");
  assert.equal(r.leagueChanged, true);
  assert.equal(r.previousLeagueRank, 1);
  assert.equal(r.leagueRank, 1);
});
test("negative corrections retained; no positive-growth award invented", async () => {
  const a = await fixture(),
    b = a.map((r) => ({
      ...r,
      date: "2026-10-14",
      ikd: Math.max(0, r.ikd - 1),
    }));
  const r = compareSnapshots(
    a,
    b,
    "village",
    a.map((x) => x.code),
    "2026-10-13",
    "2026-10-14",
  );
  assert.equal(highlights(r.rows, true).mostAdded, null);
  assert.ok(r.rows.some((x) => x.ikdAdded < 0));
});
test("all winning ties are returned, not arbitrary one", () => {
  const rows = [
    { ...row("32.73.01.1001", 10), rank: 1 },
    { ...row("32.73.01.1002", 10), rank: 1 },
  ];
  assert.equal(highlights(rows, false).topRanked.regions.length, 2);
});
test("calendar day gap handles leap day without counting upload occurrences", () => {
  assert.equal(calendarDays("2024-02-28", "2024-03-01"), 2);
  assert.equal(calendarDays("2026-10-01", "2026-10-08"), 7);
});
test("duplicate region codes fail clearly", () => {
  assert.throws(
    () =>
      rankRows([row("32.73.01.1001", 8), row("32.73.01.1001", 9)], "village"),
    /DUPLICATE/,
  );
});
test("profile excludes incomplete points from records", async () => {
  const a = await fixture("2026-10-01"),
    b = a.slice(0, -1).map((r) => ({ ...r, date: "2026-10-02" })),
    c = a.map((r) => ({ ...r, date: "2026-10-03" }));
  const p = profileHistory(
    "32.73.01.1001",
    [a, b, c],
    a.map((r) => r.code),
  );
  assert.equal(p.points[1].rank, null);
  assert.equal(p.validSnapshots, 2);
  assert.equal(p.biggestClimb, 0);
  assert.ok(p.averageRank > 0);
});
test("single complete profile has no movement records", async () => {
  const a = await fixture();
  const p = profileHistory(
    "32.73.01.1001",
    [a],
    a.map((r) => r.code),
  );
  assert.equal(p.previousRank, null);
  assert.equal(p.biggestClimb, null);
  assert.equal(p.biggestFall, null);
});
test("profile compares the previous complete snapshot across a partial date", async () => {
  const a = await fixture("2026-10-01");
  const villages = a.filter((r) => r.code.split(".").length === 4);
  villages.forEach((r, i) => (r.coverage = 100 - i * 0.5));
  const code = villages.at(-1).code;
  const b = a.slice(0, -1).map((r) => ({ ...r, date: "2026-10-02" }));
  const c = a.map((r) => ({ ...r, date: "2026-10-03" }));
  c.find((r) => r.code === code).coverage = 87;
  const p = profileHistory(
    code,
    [a, b, c],
    a.map((r) => r.code),
  );
  assert.equal(p.points[1].rank, null);
  assert.equal(p.previousDate, "2026-10-01");
  assert.equal(p.previousRank, 151);
  assert.equal(p.currentRank, 27);
  assert.equal(p.biggestClimb, 124);
});
test("a climber outside Top 20 is still highlighted", async () => {
  const a = await fixture(),
    villages = a.filter((r) => r.code.split(".").length === 4);
  villages.forEach((r, i) => (r.coverage = 100 - i * 0.5));
  const code = villages.at(-1).code,
    b = a.map((r) => ({ ...r, date: "2026-10-14" }));
  b.find((r) => r.code === code).coverage = 87;
  const result = compareSnapshots(
    a,
    b,
    "village",
    a.map((r) => r.code),
    "2026-10-13",
    "2026-10-14",
  );
  const climber = highlights(result.rows, true).biggestClimber;
  assert.equal(climber.regions[0].code, code);
  assert.ok(climber.regions[0].rank > 20);
  assert.equal(climber.value, 124);
});
test("most-added and relative-growth winners are independent", async () => {
  const a = await fixture(),
    b = a.map((r) => ({ ...r, date: "2026-10-14" })),
    codes = ["32.73.01.1001", "32.73.01.1002"];
  a.find((r) => r.code === codes[0]).ikd = 960;
  b.find((r) => r.code === codes[0]).ikd = 1210;
  a.find((r) => r.code === codes[1]).ikd = 1;
  b.find((r) => r.code === codes[1]).ikd = 5;
  const r = compareSnapshots(
      a,
      b,
      "village",
      a.map((r) => r.code),
      "2026-10-13",
      "2026-10-14",
    ),
    h = highlights(r.rows, true);
  assert.equal(h.mostAdded.regions[0].code, codes[0]);
  assert.equal(h.biggestGrowth.regions[0].code, codes[1]);
});
test("equal decimal percentage-point improvements preserve ties at Oracle scale", async () => {
  const a = await fixture(),
    b = a.map((r) => ({ ...r, date: "2026-10-14" }));
  const codes = ["32.73.01.1001", "32.73.01.1002"];
  a.find((r) => r.code === codes[0]).coverage = 24.13;
  b.find((r) => r.code === codes[0]).coverage = 24.88;
  a.find((r) => r.code === codes[1]).coverage = 8;
  b.find((r) => r.code === codes[1]).coverage = 8.75;
  const result = compareSnapshots(
    a,
    b,
    "village",
    a.map((r) => r.code),
    "2026-10-13",
    "2026-10-14",
  );
  assert.equal(
    highlights(result.rows, true).mostImprovedCoverage.regions.length,
    2,
  );
  assert.equal(highlights(result.rows, true).mostImprovedCoverage.value, 0.75);
});
