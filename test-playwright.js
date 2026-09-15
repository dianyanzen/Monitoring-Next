const { chromium } = require("playwright");

(async () => {
  console.log("=== TEST CHROME 109 ===");

  const browser = await chromium.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: [
      "--disable-gpu",
      "--no-sandbox",
    ],
  });

  console.log("Chrome 109 berhasil dijalankan.");

  const page = await browser.newPage();

  await page.goto("https://example.com", {
    waitUntil: "domcontentloaded",
  });

  console.log("URL   :", page.url());
  console.log("TITLE :", await page.title());

  await browser.close();

  console.log("Chrome berhasil ditutup.");
})();