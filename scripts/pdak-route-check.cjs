require("@next/env").loadEnvConfig(process.cwd());
const { chromium } = require("playwright");
const crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  fs.mkdirSync("logs/pdak-ui", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const port of [3000, 3273]) {
      const base = `http://localhost:${port}`;
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const raw = encodeURIComponent(
        JSON.stringify({
          S_USER_ID: "PDAK_UI_TEST",
          S_SESSION_ID: crypto.randomUUID(),
          S_NIK: "0000000000000000",
          S_USER_LEVEL: "5",
        }),
      );
      const sig = crypto
        .createHmac(
          "sha256",
          process.env.SESSION_SECRET || "dev-secret-only-local",
        )
        .update(raw)
        .digest("base64url");
      await context.addCookies([
        { name: "session_user", value: encodeURIComponent(raw), url: base },
        { name: "session_sig", value: sig, url: base },
      ]);
      const page = await context.newPage();
      page.setDefaultTimeout(60000);
      for (const api of ["upload/status", "data?dataset=KIA", "ikd/ranking?level=village&league=ALL"]) {
        const response = await context.request.get(`${base}/api/pdak/${api}`);
        assert.equal(response.status(), 200);
        assert.equal((await response.json()).success, true);
      }
      await page.route("**/api/messages/**", (route) =>
        route.fulfill({
          json: { success: true, count: 0, data: { items: [] } },
        }),
      );
      for (const [path, title] of [
        ["upload", "Upload Data PDAK"],
        ["data", "Data PDAK"],
        ["ikd/ranking", "IKD World Ranking"],
      ]) {
        const response = await page.goto(`${base}/pdak/${path}`);
        assert.equal(response.status(), 200);
        await page.getByRole("heading", { name: title, exact: true }).waitFor();
        if (path === "upload") await page.waitForFunction(() => !document.querySelector("input[multiple]")?.disabled);
        else await page.waitForFunction(() => !Array.from(document.querySelectorAll('[role="status"]')).some(el => /Memuat/.test(el.textContent)));
        assert.equal(
          await page
            .locator('.pdak-workspace-nav a[aria-current="page"]')
            .count(),
          1,
        );
        await page.screenshot({
          path: `logs/pdak-ui/${port}-${path.replaceAll("/", "-")}-desktop.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await page.screenshot({
          path: `logs/pdak-ui/${port}-${path.replaceAll("/", "-")}-mobile.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        console.log(
          `${base}/pdak/${path}: HTTP 200, heading, navigation, desktop/mobile PASS`,
        );
      }
      if (port === 3000) {
        await page.route("**/api/pdak/upload/status", (route) =>
          route.fulfill({
            json: {
              success: true,
              data: {
                date: "2026-10-13",
                items: ["KIA", "AKTA_KELAHIRAN", "PEREKAMAN_KTPL", "IKD"].map(
                  (type) => ({
                    type,
                    canUpload: true,
                    status: "EMPTY",
                    recordCount: 0,
                  }),
                ),
              },
            },
          }),
        );
        await page.route("**/api/pdak/upload", async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          await route.fulfill({
            json: {
              success: true,
              data: {
                results: [
                  {
                    type: "KIA",
                    status: "success",
                    state: "SUCCESS",
                    message: "Tersimpan",
                    recordCount: 182,
                    sourceFile: "KIA.xls",
                  },
                ],
              },
            },
          });
        });
        await page.goto(`${base}/pdak/upload`);
        const input = page.locator("input[type=file][multiple]");
        await page.waitForFunction(
          () => !document.querySelector("input[multiple]")?.disabled,
        );
        await input.setInputFiles("tests/pdak/fixtures/KIA.xls");
        await page
          .getByRole("button", { name: "Simpan ke Database", exact: true })
          .click();
        await page.getByRole("button", { name: "Simpan", exact: true }).click();
        await page.locator(".pdak-transfer progress").waitFor();
        await page
          .locator(".pdak-completion")
          .filter({ hasText: "1 kategori berhasil" })
          .waitFor();
        console.log(
          "Real file preview, upload progress and completion notification: PASS (save response mocked, no database commit)",
        );
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
