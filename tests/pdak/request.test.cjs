require("../../scripts/pdak-ts-loader.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
let session = null,
  allowed = false;
const original = Module._load;
Module._load = function (name, ...rest) {
  if (name === "@/lib/session")
    return { readServerSession: async () => session };
  if (name === "./access") return { hasPdakUploadAccess: async () => allowed };
  return original.call(this, name, ...rest);
};
const {
  authorize,
  readFiles,
  safeFileName,
} = require("../../src/lib/pdak/request.ts");
Module._load = original;
const { allowPdakRequest } = require("../../src/lib/pdak/rateLimit.ts");
test("server authorization rejects anonymous and unprivileged users", async () => {
  assert.equal((await authorize()).response.status, 401);
  session = { S_USER_ID: "staff", S_USER_LEVEL: 9 };
  assert.equal((await authorize()).response.status, 403);
  allowed = true;
  assert.equal((await authorize()).response, null);
  session = { S_USER_ID: "x".repeat(129) };
  assert.equal((await authorize()).response.status, 403);
});
function request(files, origin = "https://monalisa.test") {
  const form = new FormData();
  for (let i = 0; i < files; i++)
    form.append("files", new File(["<table></table>"], `fixture-${i}.xls`));
  return new Request("https://monalisa.test/api/pdak/upload", {
    method: "POST",
    body: form,
    headers: { origin, host: "monalisa.test" },
  });
}
test("one to four files accepted; five rejected", async () => {
  assert.equal((await readFiles(request(4))).files.length, 4);
  await assert.rejects(readFiles(request(5)));
  await assert.rejects(readFiles(request(0)));
});
test("cross-site origin rejected", async () =>
  assert.rejects(readFiles(request(1, "https://evil.test"))));
test("oversized declared body rejected", async () => {
  const r = request(1);
  r.headers.set("content-length", String(50 * 1024 * 1024));
  await assert.rejects(readFiles(r));
});
test("filename path/control characters sanitized", () =>
  assert.equal(safeFileName("../secret/ab\u0000.xls"), "ab.xls"));
test("rate limiter expires its window", () => {
  for (let i = 0; i < 12; i++)
    assert.equal(allowPdakRequest("rate-test", 1), true);
  assert.equal(allowPdakRequest("rate-test", 2), false);
  assert.equal(allowPdakRequest("rate-test", 60002), true);
});
