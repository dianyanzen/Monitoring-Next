import { execRows } from "@/lib/db";
import { CAPAIAN_SOURCES, capaianRow } from "./capaian";
export async function readCapaian(date: string | null) {
  const targets = await execRows<{
    SYSTEM_CODE: string;
    SYSTEM_VALUE_NUM: number;
  }>(
    "SELECT UPPER(SYSTEM_CODE) SYSTEM_CODE,SYSTEM_VALUE_NUM FROM SIAK_MASTER WHERE SYSTEM_TYPE=:type",
    { type: "SET_DASHBOARD" },
    {},
    "DB",
  );
  const map = Object.fromEntries(
    targets.map((r) => [r.SYSTEM_CODE, r.SYSTEM_VALUE_NUM]),
  );
  const results = await Promise.all(
    CAPAIAN_SOURCES.map(async (source) => {
      const rows = await execRows<Record<string, unknown>>(
        `SELECT TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') SNAPSHOT_DATE,${source.count} REALISASI,${source.percent} COVERAGE,${source.denominator} DENOMINATOR FROM ${source.table} WHERE KODE=:code AND TANGGAL_ENTRY=${date ? "TO_DATE(:date_value,'YYYY-MM-DD')" : `(SELECT MAX(TANGGAL_ENTRY) FROM ${source.table})`}`,
        { code: "32.73", ...(date ? { date_value: date } : {}) },
        {},
        "DB",
      );
      return capaianRow(source, rows.length === 1 ? rows[0] : undefined, map);
    }),
  );
  const dates = await execRows<{ DATE_VALUE: string }>(
    `SELECT DISTINCT TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') DATE_VALUE FROM (${CAPAIAN_SOURCES.map((s) => `SELECT TANGGAL_ENTRY FROM ${s.table}`).join(" UNION ALL ")}) ORDER BY DATE_VALUE DESC`,
    {},
    {},
    "DB",
  );
  const legacy: Record<string, string> = {};
  const fmt = (n: number | null) =>
    n === null ? "—" : n.toLocaleString("id-ID");
  results.forEach((r, i) => {
    const code = CAPAIAN_SOURCES[i].target;
    legacy[`CAPAIAN_${code}_R`] = fmt(r.realisasi);
    legacy[`CAPAIAN_${code}_P`] =
      r.coverage === null ? "—" : `${r.coverage.toFixed(2)}%`;
    legacy[`TARGET_${code}_R`] = fmt(r.target);
    legacy[`TARGET_${code}_P`] =
      r.targetCoverage === null ? "—" : `${r.targetCoverage.toFixed(2)}%`;
  });
  return {
    ...legacy,
    rows: results,
    dates: dates.map((r) => r.DATE_VALUE),
    selectedDate: date,
    timeZone: "Asia/Jakarta",
  };
}
