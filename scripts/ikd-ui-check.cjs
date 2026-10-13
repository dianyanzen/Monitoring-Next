// Real endpoints read-only; illustrative data is injected into the browser only.
require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
const { chromium } = require("playwright"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { parsePdaKFile } = require("../src/lib/pdak/parser.ts");
const {
  compareSnapshots,
  highlights,
  profileHistory,
} = require("../src/lib/pdak/ikd/analytics.ts");
(async () => {
  fs.mkdirSync("logs/ikd-ui", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 },
      }),
      raw = encodeURIComponent(
        JSON.stringify({
          S_USER_ID: "IKD_UI_TEST",
          S_SESSION_ID: crypto.randomUUID(),
          S_NIK: "0000000000000000",
          S_USER_LEVEL: 5,
        }),
      ),
      sig = crypto
        .createHmac(
          "sha256",
          process.env.SESSION_SECRET || "dev-secret-only-local",
        )
        .update(raw)
        .digest("base64url");
    await context.addCookies([
      {
        name: "session_user",
        value: encodeURIComponent(raw),
        url: "http://127.0.0.1:3314",
      },
      { name: "session_sig", value: sig, url: "http://127.0.0.1:3314" },
    ]);
    for (const path of [
      "snapshots",
      "ranking",
      "movement",
      "highlights",
      "stats",
      "region/32.73.01.1001",
    ]) {
      const r = await context.request.get(
        "http://127.0.0.1:3314/api/pdak/ikd/" + path,
        { timeout: 90000 },
      );
      assert.equal(r.status(), 200);
      assert.equal((await r.json()).success, true);
    }
    const anonymous = await browser.newContext();
    assert.equal(
      (
        await anonymous.request.get(
          "http://127.0.0.1:3314/api/pdak/ikd/ranking",
        )
      ).status(),
      401,
    );
    await anonymous.close();
    const denied = await browser.newContext(),
      deniedRaw = encodeURIComponent(
        JSON.stringify({
          S_USER_ID: "IKD_UI_NO_PERMISSION",
          S_SESSION_ID: crypto.randomUUID(),
          S_NIK: "0000000000000000",
          S_USER_LEVEL: 4,
        }),
      ),
      deniedSig = crypto
        .createHmac(
          "sha256",
          process.env.SESSION_SECRET || "dev-secret-only-local",
        )
        .update(deniedRaw)
        .digest("base64url");
    await denied.addCookies([
      {
        name: "session_user",
        value: encodeURIComponent(deniedRaw),
        url: "http://127.0.0.1:3314",
      },
      { name: "session_sig", value: deniedSig, url: "http://127.0.0.1:3314" },
    ]);
    assert.equal(
      (
        await denied.request.get("http://127.0.0.1:3314/api/pdak/ikd/ranking")
      ).status(),
      403,
    );
    await denied.close();
    const bad = await context.request.get(
      "http://127.0.0.1:3314/api/pdak/ikd/ranking?level=city",
    );
    assert.equal((await bad.json()).success, false);
    console.log(
      "All six real Oracle endpoints, anonymous rejection and invalid scope rejection: PASS",
    );
    const fixture = await parsePdaKFile(
      fs.readFileSync(
        "tests/pdak/fixtures/Capaian Target Aktivasi Identitas Kependudukan Digital.xls",
      ),
    );
    const a = fixture.rows.map((r) => ({
      date: "2026-10-01",
      code: r.KODE,
      name: r.WILAYAH,
      rekam: r.REKAM_DINAMIS,
      ikd: r.JUMLAH_IKD,
      coverage: r.PERSEN_IKD,
    }));
    const villages = a.filter((r) => r.code.split(".").length === 4);
    villages.forEach((r, i) => (r.coverage = 100 - i * 0.5));
    const target = villages.at(-1).code,
      b = a.map((r) => ({ ...r, date: "2026-10-08", ikd: r.ikd + 25 }));
    b.find((r) => r.code === target).coverage = 87;
    const reference = a.map((r) => r.code),
      snapshots = [
        { date: "2026-10-08", total: 182, complete: true },
        { date: "2026-10-01", total: 182, complete: true },
      ];
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    await page.route("**/api/messages/**", (r) =>
      r.fulfill({ json: { success: true, count: 0, data: { items: [] } } }),
    );
    await page.route("**/api/menu", (r) =>
      r.fulfill({
        json: {
          success: true,
          data: [
            {
              MENU_ID: 376,
              TITLE: "Klasemen IKD",
              URL: "/pdak/ikd/ranking",
              IS_ACTIVE: 1,
              MENU_LEVEL: 1,
            },
          ],
        },
      }),
    );
    await page.route("**/dashboard*", (r) =>
      r.fulfill({ status: 204, body: "" }),
    );
    let writes = 0;
    await page.route("**/api/pdak/upload", (r) => {
      writes++;
      return r.abort();
    });
    await page.route("**/api/pdak/ikd/ranking*", (r) => {
      const q = new URL(r.request().url()).searchParams,
        level = q.get("level") || "village",
        league = q.get("league") || "ALL",
        base = compareSnapshots(
          q.get("a") === "none" ? [] : a,
          b,
          level,
          reference,
          q.get("a") === "none" ? null : "2026-10-01",
          "2026-10-08",
        ),
        rows = base.rows.filter((x) => league === "ALL" || x.league === league);
      return r.fulfill({
        json: {
          success: true,
          data: {
            ...base,
            rows,
            league,
            snapshots,
            overallCount: base.rows.length,
            highlights: highlights(rows, base.comparable),
            cityTrend: [
              { date: "2026-10-01", coverage: 9.7 },
              { date: "2026-10-08", coverage: 10.7 },
            ],
          },
        },
      });
    });
    await page.route("**/api/pdak/ikd/region/*", (r) => {
      const code = new URL(r.request().url()).pathname.split("/").at(-1),
        p = profileHistory(code, [a, b], reference);
      return r.fulfill({
        json: {
          success: true,
          data: {
            ...p,
            name: b.find((x) => x.code === code).name,
            methodology: "UI fixture — not stored in Oracle.",
          },
        },
      });
    });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto("http://127.0.0.1:3314/pdak/ikd/ranking");
    await page
      .getByRole("heading", { name: "IKD World Ranking", exact: true })
      .waitFor();
    await page.locator(".ikd-ranking tbody tr").first().waitFor();
    assert.equal(await page.locator(".ikd-award").count(), 7);
    await page.screenshot({
      path: "logs/ikd-ui/ranking-light-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Kecamatan", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector(".pdak-data__meta")
        ?.textContent.includes("30 peserta"),
    );
    await page.getByRole("button", { name: "Kelurahan", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .querySelector(".pdak-data__meta")
        ?.textContent.includes("151 peserta"),
    );
    await page.getByLabel("Liga wilayah").selectOption("SMALL");
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="Snapshot B"]').disabled,
    );
    await page.getByLabel("Liga wilayah").selectOption("ALL");
    await page.getByPlaceholder("Kode atau nama wilayah").fill(target);
    assert.equal(await page.locator(".ikd-ranking tbody tr").count(), 1);
    await page.getByPlaceholder("Kode atau nama wilayah").fill("");
    await page.getByLabel("Snapshot A").selectOption("none");
    await page.waitForFunction(() =>
      document
        .querySelector(".pdak-upload__alert")
        ?.textContent.includes("pembanding"),
    );
    await page.getByLabel("Snapshot A").selectOption("2026-10-01");
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="Snapshot B"]').disabled,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.classList.add("dark");
      document.querySelector(".pdak-shell-main").scrollTop = 0;
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "logs/ikd-ui/ranking-dark-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(
      `http://127.0.0.1:3314/pdak/ikd/ranking/region/${target}?end=2026-10-08`,
    );
    await page.locator(".ikd-charts svg").first().waitFor();
    assert.equal(await page.locator(".ikd-charts svg").count(), 2);
    await page.screenshot({
      path: "logs/ikd-ui/profile-light-desktop.png",
      fullPage: true,
    });
    const positions = await page
      .locator(".ikd-charts svg")
      .first()
      .locator("circle")
      .evaluateAll((c) => c.map((x) => Number(x.getAttribute("cy"))));
    assert.ok(positions[1] < positions[0]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(
      () => (document.querySelector(".pdak-shell-main").scrollTop = 0),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: "logs/ikd-ui/profile-light-mobile.png",
      fullPage: true,
    });
    assert.equal(writes, 0);
    console.log(
      "Ranking, league, scope, search, baseline, profile, reversed rank axis and mobile UI: PASS (fixture only, zero writes)",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("IKD UI verification failed:", e.message);
  process.exitCode = 1;
});
