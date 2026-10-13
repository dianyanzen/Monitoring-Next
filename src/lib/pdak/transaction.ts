import oracledb from "oracledb";
import type { ParsedDataset } from "./parser";

export class DailyUploadConflict extends Error {
  constructor(
    public code: "REJECTED_DUPLICATE" | "LEGACY_RECONCILIATION_REQUIRED",
  ) {
    super(code);
  }
}

// Caller owns the transaction. Batch marker and all rows have no intermediate commit.
export async function insertDataset(
  conn: any,
  parsed: ParsedDataset,
  date: string,
  user: string,
  file: string,
  hash: string,
) {
  const binds = { b_date: date, b_type: parsed.config.type };
  const batch = await conn.execute(
    "SELECT COUNT(*) AS N FROM PDAK_UPLOAD_BATCH WHERE DATASET_TYPE=:b_type AND TANGGAL_ENTRY=TO_DATE(:b_date,'YYYY-MM-DD')",
    binds,
  );
  if (Number(batch.rows?.[0]?.N))
    throw new DailyUploadConflict("REJECTED_DUPLICATE");
  const existing = await conn.execute(
    `SELECT COUNT(*) AS N FROM ${parsed.config.table} WHERE TANGGAL_ENTRY=TO_DATE(:b_date,'YYYY-MM-DD')`,
    { b_date: date },
  );
  if (Number(existing.rows?.[0]?.N))
    throw new DailyUploadConflict("LEGACY_RECONCILIATION_REQUIRED");
  const marker = await conn.execute(
    `INSERT INTO PDAK_UPLOAD_BATCH
    (DATASET_TYPE,TANGGAL_ENTRY,STATUS,TOTAL_ROWS,INSERTED_ROWS,UPLOADED_BY,SOURCE_FILE,FILE_SHA256,UPLOADED_AT)
    VALUES (:b_type,TO_DATE(:b_date,'YYYY-MM-DD'),'COMMITTED',:b_count,:b_count,:b_user,:b_file,:b_hash,CAST(SYSTIMESTAMP AT TIME ZONE 'Asia/Jakarta' AS TIMESTAMP)) RETURNING ID INTO :b_id`,
    {
      ...binds,
      b_count: parsed.rows.length,
      b_user: user,
      b_file: file,
      b_hash: hash,
      b_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
    { autoCommit: false },
  );
  const id = marker.outBinds?.b_id?.[0];
  const columns = parsed.config.fields.map((f) => f.column);
  const sql = `INSERT INTO ${parsed.config.table} (${columns.join(",")},TANGGAL_ENTRY,INSERTED_BY,SOURCE_FILE)
    VALUES (${columns.map((c) => ":" + c).join(",")},TO_DATE(:TANGGAL_ENTRY,'YYYY-MM-DD'),:INSERTED_BY,:SOURCE_FILE)`;
  const bindDefs: Record<string, { type: number; maxSize?: number }> = {};
  for (const column of columns)
    bindDefs[column] =
      column === "KODE" || column === "WILAYAH"
        ? { type: oracledb.STRING, maxSize: column === "KODE" ? 120 : 600 }
        : { type: oracledb.NUMBER };
  bindDefs.TANGGAL_ENTRY = { type: oracledb.STRING, maxSize: 10 };
  bindDefs.INSERTED_BY = { type: oracledb.STRING, maxSize: 512 };
  bindDefs.SOURCE_FILE = { type: oracledb.STRING, maxSize: 800 };
  const result = await conn.executeMany(
    sql,
    parsed.rows.map((row) => ({
      ...row,
      TANGGAL_ENTRY: date,
      INSERTED_BY: user,
      SOURCE_FILE: file,
    })),
    { autoCommit: false, batchErrors: false, bindDefs },
  );
  if (result.rowsAffected !== 182) throw new Error("INCOMPLETE_INSERT");
  return id as number;
}
