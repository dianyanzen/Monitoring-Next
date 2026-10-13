// Real HTTP checks are read-only; browser CRUD uses isolated fixtures, never Oracle writes.
require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
const { chromium } = require("playwright"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  CAPAIAN_SOURCES,
  capaianRow,
} = require("../src/lib/dashboard/capaian.ts");
const base = "http://127.0.0.1:3314";
async function auth(context, level = 5) {
  const raw = encodeURIComponent(
    JSON.stringify({
      S_USER_ID: "INVENTORY_UI_TEST",
      S_SESSION_ID: crypto.randomUUID(),
      S_USER_LEVEL: level,
      S_NIK: "0000000000000000",
    }),
  );
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "dev-secret-only-local")
    .update(raw)
    .digest("base64url");
  await context.addCookies([
    { name: "session_user", value: encodeURIComponent(raw), url: base },
    { name: "session_sig", value: sig, url: base },
  ]);
}
(async () => {
  fs.mkdirSync("logs/inventory-ui", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
    });
    await auth(context);
    for (const endpoint of [
      "master",
      "masuk",
      "keluar",
      "status",
      "aset?sect=1",
      "cekaset",
      "laporan?start=2026-10-01&end=2026-10-13",
      "laporanaset?start=2026-10-01&end=2026-10-13",
      "options",
      "aset-options",
      "summary",
    ]) {
      const res = await context.request.get(base + "/api/barang/" + endpoint, {
        timeout: 60000,
      });
      assert.equal(res.status(), 200);
      assert.equal((await res.json()).success, true, endpoint);
    }
    const capaian = await context.request.get(base + "/api/dashboard/capaian");
    assert.equal((await capaian.json()).data.rows.length, 4);
    const cross = await context.request.post(base + "/api/barang/master", {
      headers: { origin: "https://invalid.example" },
      data: { action: "create" },
    });
    assert.equal(cross.status(), 403);
    const invalid = await context.request.get(
      base + "/api/barang/laporan?start=31-02-2026&end=01-03-2026",
    );
    assert.equal((await invalid.json()).success, false);
    const anon = await browser.newContext();
    assert.equal(
      (await anon.request.get(base + "/api/dashboard/population")).status(),
      401,
    );
    assert.equal(
      (await anon.request.get(base + "/api/barang/master")).status(),
      401,
    );
    const cron = await anon.request.get(
      base + "/api/cron/tracking-auto-complete",
      { headers: { "x-vercel-cron": "1" } },
    );
    assert.equal(cron.status(), 401);
    await anon.close();
    const denied = await browser.newContext();
    await auth(denied, 9999);
    assert.equal(
      (await denied.request.get(base + "/api/barang/master")).status(),
      403,
    );
    await denied.close();
    const forged = await browser.newContext();
    await forged.addCookies([
      {
        name: "session_user",
        value: encodeURIComponent(
          JSON.stringify({ S_USER_ID: "bad", S_USER_LEVEL: 5 }),
        ),
        url: base,
      },
    ]);
    assert.equal(
      (await forged.request.get(base + "/api/barang/master")).status(),
      401,
    );
    await forged.close();
    console.log(
      "Real 11 Barang APIs, PDAK dashboard, 401/403, forged session, cron spoof and cross-origin guard: PASS",
    );
    const master = Array.from({ length: 32 }, (_, i) => ({
      BARANG_ID: i + 1,
      JENIS_BARANG:
        i === 0
          ? "Kertas A4"
          : i === 1
            ? "<img src=x onerror=alert(1)>"
            : "Barang " + String(i + 1).padStart(2, "0"),
      SATUAN: "unit",
      HARGA: 12000 + i,
      KETERANGAN: "Catatan " + i,
      TANGGAL: "2026-10-13",
    }));
    const transactions = Array.from({ length: 32 }, (_, i) => ({
      SEQ_ID: i + 1,
      KODE_BARANG: i + 1,
      JENIS_BARANG: master[i].JENIS_BARANG,
      JUMLAH: i + 1,
      SATUAN: "unit",
      HARGA: 12000,
      TANGGAL: "13-10-2026",
      SORT_DATE: "2026-10-13",
      RECEIVED: "Petugas",
      KETERANGAN: "Catatan",
    }));
    let fail = false,
      fixtureWrites = 0;
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await context.route("**/api/menu", (r) =>
      r.fulfill({ json: { success: true, data: [] } }),
    );
    await context.route("**/api/messages/**", (r) =>
      r.fulfill({ json: { success: true, data: [], count: 0 } }),
    );
    await context.route("**/api/barang/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        mode = url.pathname.split("/").at(-1);
      const b =
        req.method() === "POST"
          ? req.postDataJSON()
          : Object.fromEntries(url.searchParams);
      const action = b.action || "list";
      if (fail && action === "list") {
        fail = false;
        return route.fulfill({
          status: 500,
          json: { success: false, message: "Koneksi uji terganggu." },
        });
      }
      if (["create", "update", "delete"].includes(action)) {
        fixtureWrites++;
        if (mode === "master") {
          if (action === "create")
            master.push({
              BARANG_ID: master.length + 1,
              JENIS_BARANG: b.jenis_barang,
              SATUAN: b.satuan,
              HARGA: Number(b.harga),
              KETERANGAN: b.keterangan,
            });
          if (action === "update") {
            const row = master.find((r) => r.BARANG_ID === b.id);
            Object.assign(row, {
              JENIS_BARANG: b.jenis_barang,
              SATUAN: b.satuan,
              HARGA: Number(b.harga),
              KETERANGAN: b.keterangan,
            });
          }
          if (action === "delete") {
            const i = master.findIndex((r) => r.BARANG_ID === b.id);
            master.splice(i, 1);
          }
        }
        return route.fulfill({
          json: { success: true, data: { id: 33 }, message: "Fixture saved" },
        });
      }
      if (mode === "summary")
        return route.fulfill({
          json: {
            success: true,
            data: {
              total: 32,
              available: 25,
              empty: 6,
              negative: 1,
              value: 1000000,
            },
          },
        });
      if (mode === "options")
        return route.fulfill({ json: { success: true, data: master } });
      if (mode === "aset-options")
        return route.fulfill({
          json: { success: true, data: [{ ID: 1, NAMA: "Komputer" }] },
        });
      let rows =
        mode === "master"
          ? master
          : mode === "masuk" || mode === "keluar"
            ? transactions
            : mode === "aset"
              ? Array.from({ length: 12 }, (_, i) => ({
                  NO: i + 1,
                  DESCRIP: "Referensi " + i,
                  SECT: Number(b.sect),
                }))
              : mode === "status"
                ? master.map((r, i) => ({
                    ...r,
                    MASUK_QTY: 20,
                    KELUAR_QTY: 10,
                    SALDO_QTY: i === 0 ? 0 : i === 1 ? -1 : 10,
                    HARGA_ASET: 120000,
                  }))
                : mode === "cekaset"
                  ? [
                      {
                        NO_KEC: 1,
                        NAMA_WIL: "Sukasari",
                        JENIS_BARANG: 1,
                        NAMA_BARANG: "Komputer",
                        MASUK_QTY: 10,
                        KELUAR_QTY: 2,
                        SALDO_QTY: 8,
                      },
                    ]
                  : mode === "laporanaset"
                    ? [
                        {
                          NO_KEC: 1,
                          NAMA_WIL: "Sukasari",
                          NAMA_BARANG: "Komputer",
                          JUMLAH: 2,
                          KATEGORI: "IN",
                          TANGGAL: "13-10-2026",
                          PENERIMA: "Petugas",
                        },
                      ]
                    : transactions.map((r) => ({
                        ...r,
                        KET: r.SEQ_ID % 2 ? "BARANG MASUK" : "BARANG KELUAR",
                      }));
      if (b.search)
        rows = rows.filter((r) =>
          String(r.JENIS_BARANG ?? r.DESCRIP ?? r.NAMA_BARANG)
            .toLowerCase()
            .includes(b.search.toLowerCase()),
        );
      if (b.status)
        rows = rows.filter((r) =>
          b.status === "empty"
            ? r.SALDO_QTY === 0
            : b.status === "negative"
              ? r.SALDO_QTY < 0
              : r.SALDO_QTY > 0,
        );
      rows = [...rows].sort((a, c) => {
        const key = b.sort || "BARANG_ID";
        const x = a[key],
          y = c[key];
        const value =
          typeof x === "number" ? x - y : String(x).localeCompare(String(y));
        return b.direction === "desc" ? -value : value;
      });
      const count = rows.length;
      const offset = (Number(b.page || 1) - 1) * Number(b.pageSize || 25);
      return route.fulfill({
        json: {
          success: true,
          data: b.page
            ? {
                rows: rows.slice(offset, offset + Number(b.pageSize)),
                total: count,
              }
            : rows,
        },
      });
    });
    await page.goto(base + "/barang/masterbarang");
    await page
      .getByRole("heading", { name: "Master Barang", exact: true })
      .waitFor();
    await page.getByRole("cell", { name: "Barang 32", exact: true }).waitFor();
    await page.getByRole("button", { name: "Berikutnya" }).click();
    await page.getByRole("cell", { name: "Kertas A4", exact: true }).waitFor();
    assert.equal(await page.locator(".monalisa-ops table img").count(), 0);
    await page.getByRole("searchbox", { name: "Cari barang" }).fill("Kertas");
    await page.getByRole("cell", { name: "Kertas A4", exact: true }).waitFor();
    await page.waitForFunction(
      () => document.querySelectorAll(".monalisa-ops tbody tr").length === 1,
    );
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page
      .getByRole("button", { name: "Hapus filter", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tambah barang", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("Jenis barang").fill("Toner baru");
    await page.getByLabel(/^Satuan/).fill("kotak");
    await page.getByLabel("Harga satuan").fill("150000");
    await page.screenshot({ path: "logs/inventory-ui/form-dark-desktop.png" });
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "berhasil disimpan" })
      .waitFor();
    await page
      .getByRole("searchbox", { name: "Cari barang" })
      .fill("Toner baru");
    await page.getByRole("cell", { name: "Toner baru", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Edit Toner baru", exact: true })
      .click();
    await page.getByLabel("Jenis barang").fill("Toner revisi");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await page
      .getByRole("button", { name: "Hapus filter", exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: "Cari barang" })
      .fill("Toner revisi");
    await page
      .getByRole("cell", { name: "Toner revisi", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Hapus Toner revisi", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Hapus data", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Tidak ada hasil yang cocok" })
      .waitFor();
    await page
      .getByRole("button", { name: "Hapus filter", exact: true })
      .click();
    await page.getByRole("cell", { name: "Barang 32", exact: true }).waitFor();
    fail = true;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Koneksi uji" }).waitFor();
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.getByRole("cell", { name: "Barang 32", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Switch to light view" })
      .click()
      .catch(async () => {
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "light";
          document.documentElement.classList.remove("dark");
          localStorage.setItem("theme", "light");
        });
      });
    await page.screenshot({
      path: "logs/inventory-ui/master-light-desktop.png",
    });
    for (const route of [
      "inputmasuk",
      "inputkeluar",
      "cekbarang",
      "masteraset",
      "inputaset",
      "cekaset",
      "laporan",
      "laporanaset",
    ]) {
      await page.goto(base + "/barang/" + route);
      await page.locator(".monalisa-ops table tbody tr").first().waitFor();
      if (route === "cekbarang") {
        await page.getByLabel("Status stok").selectOption("empty");
        await page
          .locator("tbody .ops-badge")
          .filter({ hasText: "Kosong" })
          .first()
          .waitFor();
      }
      if (route === "masteraset") {
        await page.getByLabel("Kategori referensi").selectOption("6");
        await page
          .getByRole("heading", { name: "Jenis aset wilayah", exact: true })
          .waitFor();
      }
      if (route === "inputmasuk") {
        await page.getByRole("button", { name: "Catat transaksi" }).click();
        await page
          .getByLabel("Barang", { exact: false })
          .last()
          .selectOption("1");
        await page.getByLabel("Jumlah", { exact: false }).fill("2");
        await page.getByLabel("Penerima", { exact: false }).fill("Petugas uji");
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Simpan" })
          .click();
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/barang/masterbarang");
    await page.locator("tbody tr").first().waitFor();
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    const header = await page.locator("header.fixed.top-0").boundingBox(),
      heading = await page
        .getByRole("heading", { name: "Master Barang", exact: true })
        .boundingBox();
    assert.ok(heading.y >= header.y + header.height);
    await page.screenshot({ path: "logs/inventory-ui/master-dark-mobile.png" });
    await page
      .getByRole("button", { name: "Tambah barang", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    assert.ok(
      await page.evaluate(() =>
        document.querySelector("dialog").contains(document.activeElement),
      ),
    );
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() =>
        document.querySelector("dialog").contains(document.activeElement),
      ),
    );
    await page.screenshot({ path: "logs/inventory-ui/form-dark-mobile.png" });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").count(), 0);
    await context.route("**/api/dashboard/**", (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/capaian")) {
        const old = url.searchParams.has("date");
        const rows = CAPAIAN_SOURCES.map((s, i) =>
          capaianRow(
            s,
            old && i > 0
              ? undefined
              : {
                  REALISASI: 100 + i,
                  COVERAGE: 65 + i,
                  SNAPSHOT_DATE: old ? "2026-10-01" : "2026-10-13",
                  DENOMINATOR: 200,
                },
            {
              ["TARGET_" + s.target + "_R"]: 90,
              ["TARGET_" + s.target + "_P"]: 99,
            },
          ),
        );
        return route.fulfill({
          json: {
            success: true,
            data: { rows, dates: ["2026-10-13", "2026-10-01"] },
          },
        });
      }
      return route.fulfill({ json: { success: true, data: [] } });
    });
    await page.goto(base + "/dashboard");
    await page
      .getByRole("heading", { name: "Akta Kelahiran 0–4 Tahun", exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.querySelectorAll(".capaian-card").length === 4,
      ),
    );
    await page
      .locator(".capaian-panel")
      .screenshot({ path: "logs/inventory-ui/capaian-dark-mobile.png" });
    await page.getByLabel("Tanggal snapshot").selectOption("2026-10-01");
    await page
      .getByText("Belum ada snapshot", { exact: true })
      .first()
      .waitFor();
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
      document.documentElement.classList.remove("dark");
    });
    await page.getByLabel("Tanggal snapshot").selectOption("");
    await page
      .getByRole("heading", { name: "Akta Kelahiran 0–4 Tahun", exact: true })
      .waitFor();
    await page
      .locator(".capaian-panel")
      .screenshot({ path: "logs/inventory-ui/capaian-light-desktop.png" });
    assert.equal(fixtureWrites, 4);
    assert.deepEqual(pageErrors, []);
    console.log(
      "All Barang pages, fixture CRUD, filters, pagination, empty/error, keyboard dialog, themes, mobile header and PDAK dashboard: PASS (zero real writes)",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("Inventory UI verification failed:", e.message);
  process.exitCode = 1;
});
