// Read-only audit. Never prints credentials, addresses, or row data.
require("@next/env").loadEnvConfig(process.cwd());
const oracle = require("oracledb");
oracle.outFormat = oracle.OUT_FORMAT_OBJECT;
(async () => {
  for (const alias of ["DB"]) {
    let conn;
    try {
      const p = process.env;
      conn = await oracle.getConnection({
        user: p[alias + "_USERNAME"] || p[alias + "_USER"],
        password: p[alias + "_PASSWORD"] || p[alias + "_PASS"],
        connectString:
          p[alias + "_CONN"] ||
          `${p[alias + "_HOST"]}:${p[alias + "_PORT"]}/${p[alias + "_SERVICE_NAME"] || p[alias + "_DATABASE"]}`,
        connectTimeout: 5,
      });
      conn.callTimeout = 10000;
      const queries = {
        columns:
          "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHAR_LENGTH, DATA_PRECISION, DATA_SCALE, NULLABLE FROM USER_TAB_COLUMNS WHERE TABLE_NAME IN ('PDAK_KIA','PDAK_AKTA_KELAHIRAN_04','PDAK_PEREKAMAN_KTPL','PDAK_IKD','PDAK_UPLOAD_BATCH','SIAK_MENU','SIAK_AKSES') ORDER BY TABLE_NAME,COLUMN_ID",
        constraints:
          "SELECT C.TABLE_NAME,C.CONSTRAINT_NAME,C.CONSTRAINT_TYPE,C.STATUS,C.VALIDATED,C.SEARCH_CONDITION_VC, CC.COLUMN_NAME FROM USER_CONSTRAINTS C LEFT JOIN USER_CONS_COLUMNS CC ON CC.CONSTRAINT_NAME=C.CONSTRAINT_NAME WHERE C.TABLE_NAME LIKE 'PDAK%' ORDER BY C.TABLE_NAME,C.CONSTRAINT_NAME,CC.POSITION",
        accessible:
          "SELECT DISTINCT OWNER,TABLE_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME LIKE 'PDAK%' OR TABLE_NAME IN ('SETUP_KAB','SETUP_KEC','SETUP_KEL','VW_SIAK_MENU')",
        menu: "SELECT MENU_ID,URL,USER_LEVEL FROM VW_SIAK_MENU WHERE LOWER(URL) LIKE '%pdak%'",
        version:
          "SELECT VERSION FROM PRODUCT_COMPONENT_VERSION WHERE PRODUCT LIKE 'Oracle%'",
        identity:
          "SELECT COLUMN_NAME,GENERATION_TYPE,SEQUENCE_NAME FROM USER_TAB_IDENTITY_COLS WHERE TABLE_NAME='PDAK_UPLOAD_BATCH'",
        menuRoots:
          "SELECT MENU_ID,PARENT_ID,TITLE,MENU_LEVEL,IS_ACTIVE,IS_NEXT FROM SIAK_MENU WHERE MENU_LEVEL=1 ORDER BY MENU_ID",
        userLevels:
          "SELECT USER_LEVEL,LEVEL_NAME FROM SIAK_USER_LEVEL ORDER BY USER_LEVEL",
        counts:
          "SELECT 'KIA' AS DATASET,COUNT(*) AS N FROM PDAK_KIA UNION ALL SELECT 'AKTA',COUNT(*) FROM PDAK_AKTA_KELAHIRAN_04 UNION ALL SELECT 'KTPL',COUNT(*) FROM PDAK_PEREKAMAN_KTPL UNION ALL SELECT 'IKD',COUNT(*) FROM PDAK_IKD UNION ALL SELECT 'BATCH',COUNT(*) FROM PDAK_UPLOAD_BATCH",
        regions:
          "SELECT LPAD(NO_PROP,2,'0')||'.'||LPAD(NO_KAB,2,'0') AS KODE,NAMA_KAB AS WILAYAH FROM SETUP_KAB WHERE NO_PROP=32 AND NO_KAB=73 UNION ALL SELECT LPAD(NO_PROP,2,'0')||'.'||LPAD(NO_KAB,2,'0')||'.'||LPAD(NO_KEC,2,'0'),NAMA_KEC FROM SETUP_KEC WHERE NO_PROP=32 AND NO_KAB=73 UNION ALL SELECT LPAD(NO_PROP,2,'0')||'.'||LPAD(NO_KAB,2,'0')||'.'||LPAD(NO_KEC,2,'0')||'.'||LPAD(NO_KEL,4,'0'),NAMA_KEL FROM SETUP_KEL WHERE NO_PROP=32 AND NO_KAB=73",
      };
      for (const [name, sql] of Object.entries(queries)) {
        try {
          console.log(
            JSON.stringify({
              alias,
              name,
              rows: (await conn.execute(sql)).rows,
            }),
          );
        } catch (e) {
          console.log(
            JSON.stringify({ alias, name, error: e.code || e.errorNum }),
          );
        }
      }
    } catch (e) {
      console.log(
        JSON.stringify({ alias, error: e.code || e.errorNum || e.name }),
      );
    } finally {
      if (conn) await conn.close();
    }
  }
})().catch(() => {
  process.exitCode = 1;
});
