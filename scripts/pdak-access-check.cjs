require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
const Module = require("node:module"),
  original = Module._load;
Module._load = function (name, ...args) {
  return name === "server-only" ? {} : original.call(this, name, ...args);
};
const { getOracleConnection } = require("../src/lib/oracle.ts");
const access = require("../src/lib/pdak/access.ts");
(async () => {
  const conn = await getOracleConnection("DB");
  try {
    console.log(
      JSON.stringify(
        (
          await conn.execute(
            "SELECT MENU_ID, URL, USER_LEVEL, ACTIVE_MENU, IS_ACTIVE, IS_NEXT FROM VW_SIAK_MENU WHERE USER_LEVEL=5 AND LOWER(URL) LIKE '%pdak%'",
          )
        ).rows,
      ),
    );
    for (const level of [5, "5"]) {
      console.log(
        JSON.stringify({
          level,
          upload: await access.hasPdakUploadAccess(level),
          data: await access.hasPdakViewAccess(level),
          ranking: await access.hasIkdRankingAccess(level),
        }),
      );
    }
  } finally {
    await conn.close();
  }
})()
  .catch((e) => {
    console.error(e.code || e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const pool of globalThis.__ORACLE_POOLS__?.values() || [])
      await pool.close(0);
  });
