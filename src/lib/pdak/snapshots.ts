import { DATASETS } from "./config";
import type { DatasetType } from "./config";

export function snapshotDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000')) throw new Error("INVALID_DATE");
  const d = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    throw new Error("INVALID_DATE");
  return value;
}

// Connection supplied by the schema-checked MONALISA repository.
export async function readSnapshot(
  conn: any,
  type: DatasetType,
  date: string | null,
) {
  const dataset = DATASETS.find((d) => d.type === type);
  if (!dataset) throw new Error("INVALID_DATASET");
  const available = await conn.execute(
    `SELECT DISTINCT TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') AS SNAPSHOT_DATE FROM ${dataset.table} ORDER BY SNAPSHOT_DATE DESC`,
  );
  const dates = (available.rows ?? []).map(
    (r: { SNAPSHOT_DATE: string }) => r.SNAPSHOT_DATE,
  );
  const selectedDate = date ?? dates[0] ?? null;
  const result = selectedDate
    ? await conn.execute(
        `SELECT ${dataset.fields.map((f) => f.column).join(",")} FROM ${dataset.table} WHERE TANGGAL_ENTRY=TO_DATE(:b_date,'YYYY-MM-DD') ORDER BY KODE`,
        { b_date: selectedDate },
      )
    : { rows: [] };
  return {
    datasetType: type,
    label: dataset.label,
    date: selectedDate,
    latestDate: dates[0] ?? null,
    dates,
    fields: dataset.fields,
    rows: result.rows ?? [],
    timeZone: "Asia/Jakarta",
  };
}
