// Explicit, idempotent menu DML. Run only for the user-approved level.
require("@next/env").loadEnvConfig(process.cwd());
require("./pdak-ts-loader.cjs");
const Module = require("node:module"),
  original = Module._load;
Module._load = function (name, ...rest) {
  return name === "server-only" ? {} : original.call(this, name, ...rest);
};
const { getOracleConnection } = require("../src/lib/oracle.ts");
const {
  hasPdakUploadAccess,
  hasPdakViewAccess,
  hasIkdRankingAccess,
} = require("../src/lib/pdak/access.ts");
(async () => {
  const level = Number(process.argv[2]);
  const view = process.argv.includes("--view");
  const ranking = process.argv.includes("--ranking");
  const url = ranking ? "pdak/ikd/ranking" : view ? "pdak/data" : "pdak/upload";
  const title = ranking
    ? "Klasemen IKD"
    : view
      ? "Data PDAK"
      : "Upload Data PDAK";
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    !process.argv.includes("--apply")
  )
    throw new Error(
      "Usage: node scripts/pdak-seed-menu.cjs USER_LEVEL --apply",
    );
  const conn = await getOracleConnection("DB");
  conn.callTimeout = 15000;
  try {
    const role = await conn.execute(
      "SELECT LEVEL_NAME FROM SIAK_USER_LEVEL WHERE USER_LEVEL=:b_level",
      { b_level: level },
    );
    if (role.rows?.length !== 1) throw new Error("Invalid user level");
    await conn.execute("LOCK TABLE SIAK_MENU IN SHARE ROW EXCLUSIVE MODE");
    const existing = await conn.execute(
      "SELECT MENU_ID FROM SIAK_MENU WHERE LOWER(TRIM(BOTH '/' FROM TRIM(URL)))=:b_url",
      { b_url: url },
    );
    if (existing.rows.length > 1)
      throw new Error("Duplicate existing menu URLs require reconciliation");
    let id = existing.rows[0]?.MENU_ID;
    if (!id) {
      const next = await conn.execute(
        "SELECT NVL(MAX(MENU_ID),0)+1 AS ID FROM SIAK_MENU",
      );
      id = next.rows[0].ID;
      await conn.execute(
        `INSERT INTO SIAK_MENU (MENU_ID,PARENT_ID,TITLE,URL,ICON,MENU_LEVEL,LEVEL_HEAD,LEVEL_SUB,LEVEL_CONTENT,IS_NEXT,IS_ACTIVE,IS_BLANK)
        VALUES(:b_id,0,:b_title,:b_url,:b_icon,1,90,0,0,1,1,0)`,
        {
          b_id: id,
          b_title: title,
          b_url: "/" + url,
          b_icon: ranking
            ? "mdi mdi-trophy"
            : view
              ? "mdi mdi-table"
              : "mdi mdi-upload",
        },
        { autoCommit: false },
      );
    }
    await conn.execute(
      `MERGE INTO SIAK_AKSES A USING (SELECT :b_level AS USER_LEVEL,:b_id AS MENU_ID FROM DUAL) B
      ON (A.USER_LEVEL=B.USER_LEVEL AND A.MENU_ID=B.MENU_ID)
      WHEN MATCHED THEN UPDATE SET A.IS_ACTIVE=1
      WHEN NOT MATCHED THEN INSERT (USER_LEVEL,MENU_ID,IS_ACTIVE) VALUES(B.USER_LEVEL,B.MENU_ID,1)`,
      { b_level: level, b_id: id },
      { autoCommit: false },
    );
    const verify = await conn.execute(
      "SELECT COUNT(*) AS N FROM VW_SIAK_MENU WHERE MENU_ID=:b_id AND USER_LEVEL=:b_level AND ACTIVE_MENU=1 AND IS_NEXT=1 AND IS_ACTIVE=1",
      { b_id: id, b_level: level },
    );
    if (verify.rows[0].N !== 1)
      throw new Error("Menu view permission verification failed");
    await conn.commit();
    console.log(
      JSON.stringify({
        menuId: id,
        userLevel: level,
        role: role.rows[0].LEVEL_NAME,
        status: "COMMITTED",
      }),
    );
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.close();
  }
  if (
    !(await (ranking
      ? hasIkdRankingAccess(level)
      : view
        ? hasPdakViewAccess(level)
        : hasPdakUploadAccess(level)))
  )
    throw new Error("Post-commit permission verification failed");
  console.log("Post-commit PDAK permission check: PASS");
})()
  .catch((e) => {
    console.error("Menu seed failed:", e.code || e.errorNum || e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const p of globalThis.__ORACLE_POOLS__?.values() || [])
      await p.close(0);
  });
