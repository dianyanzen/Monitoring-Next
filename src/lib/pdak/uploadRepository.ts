import { getOracleConnection } from "@/lib/oracle";
import { DATASETS } from "./config";
import type { ParsedDataset } from "./parser";
import { insertDataset } from "./transaction";

export const PDAK_ALIAS = "DB";
type Connection = Awaited<ReturnType<typeof getOracleConnection>>;

// Verify the configured pool's schema before any write. No implicit DDL or guessed grants.
export async function checkSchema(conn: Connection) {
  const result = await conn.execute(
    `SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,CHAR_LENGTH,DATA_PRECISION,DATA_SCALE,NULLABLE FROM USER_TAB_COLUMNS WHERE TABLE_NAME IN ('PDAK_KIA','PDAK_AKTA_KELAHIRAN_04','PDAK_PEREKAMAN_KTPL','PDAK_IKD','PDAK_UPLOAD_BATCH')`,
  );
  const rows = (result.rows as any[]) ?? [];
  for (const dataset of DATASETS) {
    const fields = rows.filter((r) => r.TABLE_NAME === dataset.table);
    if (fields.length !== dataset.fields.length + 4)
      throw new Error("PDAK_SCHEMA_MISMATCH");
    for (const field of dataset.fields) {
      const actual = fields.find((r) => r.COLUMN_NAME === field.column);
      const text = field.column === "KODE" || field.column === "WILAYAH";
      if (
        !actual ||
        actual.DATA_TYPE !== (text ? "VARCHAR2" : "NUMBER") ||
        (text &&
          Number(actual.CHAR_LENGTH) < (field.column === "KODE" ? 30 : 150)) ||
        (!text &&
          Number(actual.DATA_SCALE) !== (/PERSEN/.test(field.column) ? 4 : 0))
      )
        throw new Error("PDAK_SCHEMA_MISMATCH");
    }
    for (const [name, type] of [
      ["TANGGAL_ENTRY", "DATE"],
      ["INSERTED_AT", "TIMESTAMP(6)"],
      ["INSERTED_BY", "VARCHAR2"],
      ["SOURCE_FILE", "VARCHAR2"],
    ]) {
      if (!fields.some((r) => r.COLUMN_NAME === name && r.DATA_TYPE === type))
        throw new Error("PDAK_SCHEMA_MISMATCH");
    }
    if (fields.find((r) => r.COLUMN_NAME === "TANGGAL_ENTRY")?.NULLABLE !== "N")
      throw new Error("PDAK_SCHEMA_MISMATCH");
  }
  const batchFields = [
    "ID",
    "DATASET_TYPE",
    "TANGGAL_ENTRY",
    "STATUS",
    "TOTAL_ROWS",
    "INSERTED_ROWS",
    "UPLOADED_BY",
    "UPLOADED_AT",
    "SOURCE_FILE",
    "FILE_SHA256",
  ];
  if (
    batchFields.some(
      (c) =>
        !rows.some(
          (r) => r.TABLE_NAME === "PDAK_UPLOAD_BATCH" && r.COLUMN_NAME === c,
        ),
    )
  )
    throw new Error("PDAK_BATCH_MIGRATION_REQUIRED");
  const constraints = await conn.execute(
    `SELECT C.TABLE_NAME,C.CONSTRAINT_NAME,C.CONSTRAINT_TYPE,C.SEARCH_CONDITION_VC,CC.COLUMN_NAME FROM USER_CONSTRAINTS C LEFT JOIN USER_CONS_COLUMNS CC ON C.CONSTRAINT_NAME=CC.CONSTRAINT_NAME WHERE C.TABLE_NAME IN ('PDAK_KIA','PDAK_AKTA_KELAHIRAN_04','PDAK_PEREKAMAN_KTPL','PDAK_IKD','PDAK_UPLOAD_BATCH') AND C.STATUS='ENABLED' AND C.VALIDATED='VALIDATED'`,
  );
  const cs = (constraints.rows as any[]) ?? [];
  for (const table of [...DATASETS.map((d) => d.table), "PDAK_UPLOAD_BATCH"]) {
    const expected =
      table === "PDAK_UPLOAD_BATCH"
        ? ["DATASET_TYPE", "TANGGAL_ENTRY"]
        : ["KODE", "TANGGAL_ENTRY"];
    const names = new Set(
      cs
        .filter(
          (c) =>
            c.TABLE_NAME === table && ["P", "U"].includes(c.CONSTRAINT_TYPE),
        )
        .map((c) => c.CONSTRAINT_NAME),
    );
    if (
      ![...names].some((name) => {
        const cols = cs
          .filter((c) => c.CONSTRAINT_NAME === name)
          .map((c) => c.COLUMN_NAME);
        return cols.length === 2 && expected.every((c) => cols.includes(c));
      })
    )
      throw new Error("PDAK_UNIQUE_CONSTRAINT_REQUIRED");
    if (
      !cs.some(
        (c) =>
          c.TABLE_NAME === table &&
          c.CONSTRAINT_TYPE === "C" &&
          /TANGGAL_ENTRY\s*=\s*TRUNC\s*\(\s*TANGGAL_ENTRY\s*\)/i.test(
            String(c.SEARCH_CONDITION_VC).replace(/"/g, ""),
          ),
      )
    )
      throw new Error("PDAK_DATE_CONSTRAINT_REQUIRED");
  }
}

export async function withPdakConnection<T>(
  work: (conn: Connection) => Promise<T>,
) {
  const conn = await getOracleConnection(PDAK_ALIAS);
  try {
    conn.callTimeout = 15000;
    await checkSchema(conn);
    return await work(conn);
  } finally {
    try {
      await conn.close();
    } catch {
      /* Connection cleanup must not mask a committed upload. */
    }
  }
}

export async function loadRegionMaster() {
  return withPdakConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT LPAD(NO_PROP,2,'0')||'.'||LPAD(NO_KAB,2,'0') AS KODE,NAMA_KAB AS WILAYAH FROM SETUP_KAB WHERE NO_PROP=:p AND NO_KAB=:k
      UNION ALL SELECT LPAD(NO_PROP,2,'0')||'.'||LPAD(NO_KAB,2,'0')||'.'||LPAD(NO_KEC,2,'0'),NAMA_KEC FROM SETUP_KEC WHERE NO_PROP=:p AND NO_KAB=:k
      UNION ALL SELECT LPAD(NO_PROP,2,'0')||'.'||LPAD(NO_KAB,2,'0')||'.'||LPAD(NO_KEC,2,'0')||'.'||LPAD(NO_KEL,4,'0'),NAMA_KEL FROM SETUP_KEL WHERE NO_PROP=:p AND NO_KAB=:k`,
      { p: process.env.NO_PROP || "32", k: process.env.NO_KAB || "73" },
    );
    const rows = (result.rows as { KODE: string; WILAYAH: string }[]) ?? [];
    const master = new Map(rows.map((r) => [r.KODE.trim(), r.WILAYAH.trim()]));
    if (master.size !== 182) throw new Error("PDAK_REGION_MASTER_MISMATCH");
    return master;
  });
}

export async function saveDataset(
  parsed: ParsedDataset,
  date: string,
  user: string,
  file: string,
  hash: string,
) {
  return withPdakConnection(async (conn) => {
    let committing = false;
    let id: number;
    try {
      id = await insertDataset(conn, parsed, date, user, file, hash);
      committing = true;
      await conn.commit();
    } catch (error) {
      try {
        await conn.rollback();
      } catch {}
      if (committing) {
        const confirmed = await withPdakConnection(async (fresh) => {
          const result = await fresh.execute(
            "SELECT TOTAL_ROWS FROM PDAK_UPLOAD_BATCH WHERE ID=:b_id AND FILE_SHA256=:b_hash AND STATUS='COMMITTED'",
            { b_id: id, b_hash: hash },
          );
          return Number((result.rows as any[])?.[0]?.TOTAL_ROWS) === 182;
        }).catch(() => false);
        if (confirmed) return;
      }
      throw error;
    }
  });
}

export async function uploadStatus(date: string) {
  return withPdakConnection(async (conn) => {
    const batch = await conn.execute(
      `SELECT ID,DATASET_TYPE,STATUS,TOTAL_ROWS,UPLOADED_BY,SOURCE_FILE,TO_CHAR(UPLOADED_AT,'YYYY-MM-DD"T"HH24:MI:SS') AS UPLOADED_AT FROM PDAK_UPLOAD_BATCH WHERE TANGGAL_ENTRY=TO_DATE(:b_date,'YYYY-MM-DD')`,
      { b_date: date },
    );
    const rows = (batch.rows as any[]) ?? [];
    const items = [];
    for (const d of DATASETS) {
      const r = rows.find((r) => r.DATASET_TYPE === d.type);
      const count = await conn.execute(
        `SELECT COUNT(*) AS N FROM ${d.table} WHERE TANGGAL_ENTRY=TO_DATE(:b_date,'YYYY-MM-DD')`,
        { b_date: date },
      );
      const n = Number((count.rows as any[])?.[0]?.N ?? 0);
      const uploaded = r?.STATUS === "COMMITTED";
      items.push({
        type: d.type,
        datasetType: d.type,
        label: d.label,
        table: d.table,
        status: uploaded
          ? "SUCCESS"
          : n
            ? "LEGACY_RECONCILIATION_REQUIRED"
            : "NOT_UPLOADED",
        canUpload: !uploaded && !n,
        snapshotDate: date,
        uploadedAt: r?.UPLOADED_AT ?? null,
        uploadedBy: r?.UPLOADED_BY ?? null,
        user: r?.UPLOADED_BY ?? null,
        sourceFile: r?.SOURCE_FILE ?? null,
        rows: n,
        recordCount: n,
        batchId: r?.ID ?? null,
      });
    }
    return items;
  });
}

export async function uploadHistory(limit: number, offset: number) {
  return withPdakConnection(async (conn) => {
    const optional = await conn.execute(
      "SELECT COUNT(*) AS N FROM USER_TABLES WHERE TABLE_NAME='PDAK_UPLOAD_ATTEMPT'",
    );
    const hasAttempts = Number((optional.rows as any[])?.[0]?.N) > 0;
    const attemptSql = hasAttempts
      ? "UNION ALL SELECT 'A-'||ID,DATASET_TYPE,TANGGAL_ENTRY,STATUS,0,UPLOADED_BY,SOURCE_FILE,UPLOADED_AT,ERROR_CODE,ERROR_MESSAGE FROM PDAK_UPLOAD_ATTEMPT"
      : "";
    const result = await conn.execute(
      `SELECT ID AS "id",DATASET_TYPE AS "datasetType",TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') AS "snapshotDate",STATUS AS "status",RECORD_COUNT AS "rows",UPLOADED_BY AS "uploadedBy",SOURCE_FILE AS "sourceFile",TO_CHAR(UPLOADED_AT,'YYYY-MM-DD"T"HH24:MI:SS') AS "uploadedAt",ERROR_CODE AS "errorCode",ERROR_MESSAGE AS "message",COUNT(*) OVER() AS "total" FROM (
      SELECT 'B-'||TO_CHAR(ID) AS ID,DATASET_TYPE,TANGGAL_ENTRY,STATUS,TOTAL_ROWS AS RECORD_COUNT,UPLOADED_BY,SOURCE_FILE,UPLOADED_AT,CAST(NULL AS VARCHAR2(40)) AS ERROR_CODE,CAST(NULL AS VARCHAR2(300)) AS ERROR_MESSAGE FROM PDAK_UPLOAD_BATCH
      ${attemptSql}
    ) ORDER BY UPLOADED_AT DESC,ID DESC OFFSET :b_offset ROWS FETCH NEXT :b_limit ROWS ONLY`,
      { b_limit: limit, b_offset: offset },
    );
    return result.rows ?? [];
  });
}

export async function recordFailedAttempt(
  date: string,
  user: string,
  type: string | null,
  file: string,
  code: string,
) {
  const conn = await getOracleConnection(PDAK_ALIAS);
  const messages: Record<string, string> = {
    INVALID_FILE: "File gagal validasi.",
    REJECTED_DUPLICATE: "Dataset sudah diupload hari ini.",
    LEGACY_RECONCILIATION_REQUIRED:
      "Data harian tanpa batch memerlukan rekonsiliasi.",
    DATABASE_ERROR: "Penyimpanan belum terkonfirmasi; periksa status.",
  };
  try {
    conn.callTimeout = 10000;
    await conn.execute(
      `INSERT INTO PDAK_UPLOAD_ATTEMPT (DATASET_TYPE,TANGGAL_ENTRY,STATUS,UPLOADED_BY,SOURCE_FILE,UPLOADED_AT,ERROR_CODE,ERROR_MESSAGE) VALUES (:b_type,TO_DATE(:b_date,'YYYY-MM-DD'),:b_code,:b_user,:b_file,CAST(SYSTIMESTAMP AT TIME ZONE 'Asia/Jakarta' AS TIMESTAMP),:b_code,:b_message)`,
      {
        b_type: DATASETS.some((d) => d.type === type) ? type : null,
        b_date: date,
        b_code: code,
        b_user: user,
        b_file: file,
        b_message: messages[code] || "Percobaan upload gagal.",
      },
      { autoCommit: false },
    );
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    await conn.close();
  }
}
