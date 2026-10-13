import { withPdakConnection, loadRegionMaster } from "../uploadRepository";
import {
  compareSnapshots,
  highlights,
  type IkdRow,
  type Level,
  type League,
  regionLevel,
  profileSummary,
} from "./analytics";

export class RankingInputError extends Error {}
type Meta = { date: string; total: number; complete: boolean };
function referenceSql(reference: string[]) {
  const binds: Record<string, string> = {};
  const list = reference
    .map((c, i) => {
      binds["r" + i] = c;
      return ":r" + i;
    })
    .join(",");
  return { binds, list };
}
function metrics(raw: any): IkdRow {
  const numeric = (v: any) =>
    v === null || v === undefined
      ? null
      : Number.isFinite(Number(v))
        ? Number(v)
        : null;
  return {
    date: raw.SNAPSHOT_DATE,
    code: String(raw.KODE),
    name: String(raw.WILAYAH ?? ""),
    rekam: numeric(raw.REKAM_DINAMIS),
    ikd: numeric(raw.JUMLAH_IKD),
    coverage: numeric(raw.PERSEN_IKD),
  };
}
function metadataSql(list: string) {
  return `SELECT TANGGAL_ENTRY,COUNT(*) AS TOTAL,
 SUM(CASE WHEN REGEXP_COUNT(KODE,'[.]')=1 THEN 1 ELSE 0 END) AS CITY,
 SUM(CASE WHEN REGEXP_COUNT(KODE,'[.]')=2 THEN 1 ELSE 0 END) AS DISTRICT,
 SUM(CASE WHEN REGEXP_COUNT(KODE,'[.]')=3 THEN 1 ELSE 0 END) AS VILLAGE,
 SUM(CASE WHEN PERSEN_IKD BETWEEN 0 AND 100 AND KODE IN (${list}) THEN 1 ELSE 0 END) AS VALID_SCORE
 FROM PDAK_IKD GROUP BY TANGGAL_ENTRY`;
}
export async function rankingSnapshots() {
  const master = await loadRegionMaster(),
    reference = [...master.keys()];
  return withPdakConnection((conn) => snapshotsOnConnection(conn, reference));
}
export async function snapshotsOnConnection(conn: any, reference: string[]) {
  const { list, binds } = referenceSql(reference);
  const result = await conn.execute(
    `SELECT TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') AS SNAPSHOT_DATE,TOTAL,CITY,DISTRICT,VILLAGE,VALID_SCORE FROM (${metadataSql(list)}) ORDER BY TANGGAL_ENTRY DESC`,
    binds,
  );
  const snapshots: Meta[] = ((result.rows as any[]) ?? []).map((r) => ({
    date: r.SNAPSHOT_DATE,
    total: Number(r.TOTAL),
    complete:
      r.TOTAL === 182 &&
      r.CITY === 1 &&
      r.DISTRICT === 30 &&
      r.VILLAGE === 151 &&
      r.VALID_SCORE === 182,
  }));
  return { snapshots, reference };
}
export type RankingOptions = {
  level: Level;
  league: League;
  dateA?: string | null;
  dateB?: string | null;
  noBaseline?: boolean;
};
export async function rankingAnalysis(options: RankingOptions) {
  const context = await rankingSnapshots();
  return withPdakConnection((conn) =>
    analysisOnConnection(conn, options, context),
  );
}
export async function analysisOnConnection(
  conn: any,
  options: RankingOptions,
  { snapshots, reference }: { snapshots: Meta[]; reference: string[] },
) {
  const dateB = options.dateB ?? snapshots[0]?.date ?? null;
  if (dateB && !snapshots.some((s) => s.date === dateB))
    throw new RankingInputError("Snapshot B tidak tersedia.");
  const dateA = options.noBaseline
    ? null
    : (options.dateA ??
      snapshots.find((s) => s.complete && dateB && s.date < dateB)?.date ??
      null);
  if (dateA && !snapshots.some((s) => s.date === dateA))
    throw new RankingInputError("Snapshot A tidak tersedia.");
  if (dateA && dateB && dateA >= dateB)
    throw new RankingInputError("Tanggal A harus lebih awal daripada B.");
  const result = dateB
    ? await conn.execute(
        `SELECT KODE,WILAYAH,REKAM_DINAMIS,JUMLAH_IKD,PERSEN_IKD,TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') AS SNAPSHOT_DATE FROM PDAK_IKD WHERE TANGGAL_ENTRY=TO_DATE(:b_b,'YYYY-MM-DD') OR TANGGAL_ENTRY=TO_DATE(:b_a,'YYYY-MM-DD')`,
        { b_a: dateA, b_b: dateB },
      )
    : { rows: [] };
  const data = ((result.rows as any[]) ?? []).map(metrics);
  const analysis = compareSnapshots(
    data.filter((r) => r.date === dateA),
    data.filter((r) => r.date === dateB),
    options.level,
    reference,
    dateA,
    dateB,
  );
  const visible = analysis.rows.filter(
    (r) => options.league === "ALL" || r.league === options.league,
  );
  const cityCode = reference.find((c) => /^\d{2}\.\d{2}$/.test(c));
  const trend = dateB
    ? await conn.execute(
        `SELECT KODE,WILAYAH,REKAM_DINAMIS,JUMLAH_IKD,PERSEN_IKD,TO_CHAR(TANGGAL_ENTRY,'YYYY-MM-DD') AS SNAPSHOT_DATE FROM PDAK_IKD WHERE KODE=:b_city AND TANGGAL_ENTRY BETWEEN TO_DATE(:b_a,'YYYY-MM-DD') AND TO_DATE(:b_b,'YYYY-MM-DD') ORDER BY TANGGAL_ENTRY`,
        { b_city: cityCode, b_a: dateA ?? dateB, b_b: dateB },
      )
    : { rows: [] };
  return {
    ...analysis,
    rows: visible,
    overallCount: analysis.rows.length,
    league: options.league,
    snapshots,
    highlights: highlights(visible, analysis.comparable),
    cityTrend: ((trend.rows as any[]) ?? []).map(metrics),
  };
}
export async function rankingProfile(code: string, end: string | null) {
  const level = regionLevel(code);
  if (!level)
    throw new RankingInputError(
      "Pilih kode kecamatan atau kelurahan yang valid.",
    );
  const master = await loadRegionMaster();
  if (!master.has(code))
    throw new RankingInputError("Kode wilayah tidak ditemukan.");
  const reference = [...master.keys()];
  return withPdakConnection((conn) =>
    profileOnConnection(conn, code, end, reference, master.get(code)!),
  );
}
export async function profileOnConnection(
  conn: any,
  code: string,
  end: string | null,
  reference: string[],
  name = code,
) {
  const level = regionLevel(code);
  if (!level) throw new RankingInputError("Kode wilayah tidak valid.");
  const { list, binds } = referenceSql(reference);
  // Compute ranks across all participants first; filter the chosen KODE only outside R.
  const result = await conn.execute(
    `WITH Q AS (${metadataSql(list)}),R AS (
      SELECT KODE,TANGGAL_ENTRY,RANK() OVER(PARTITION BY TANGGAL_ENTRY,REGEXP_COUNT(KODE,'[.]') ORDER BY PERSEN_IKD DESC) AS SCORE_RANK
      FROM PDAK_IKD WHERE PERSEN_IKD BETWEEN 0 AND 100 AND KODE IN (${list})
    ) SELECT TO_CHAR(Q.TANGGAL_ENTRY,'YYYY-MM-DD') AS SNAPSHOT_DATE,
      CASE WHEN Q.TOTAL=182 AND Q.CITY=1 AND Q.DISTRICT=30 AND Q.VILLAGE=151 AND Q.VALID_SCORE=182 THEN R.SCORE_RANK ELSE NULL END AS SCORE_RANK,
      CASE WHEN Q.TOTAL=182 AND Q.CITY=1 AND Q.DISTRICT=30 AND Q.VILLAGE=151 AND Q.VALID_SCORE=182 THEN 1 ELSE 0 END AS COMPLETE,
      P.PERSEN_IKD,P.JUMLAH_IKD,P.REKAM_DINAMIS,P.WILAYAH FROM Q
      LEFT JOIN PDAK_IKD P ON P.TANGGAL_ENTRY=Q.TANGGAL_ENTRY AND P.KODE=:b_code
      LEFT JOIN R ON R.TANGGAL_ENTRY=Q.TANGGAL_ENTRY AND R.KODE=:b_code
      WHERE (:b_end IS NULL OR Q.TANGGAL_ENTRY<=TO_DATE(:b_end,'YYYY-MM-DD')) ORDER BY Q.TANGGAL_ENTRY`,
    { ...binds, b_code: code, b_end: end },
  );
  const points = ((result.rows as any[]) ?? []).map((r) => ({
    date: r.SNAPSHOT_DATE,
    rank: r.SCORE_RANK === null ? null : Number(r.SCORE_RANK),
    coverage: r.PERSEN_IKD === null ? null : Number(r.PERSEN_IKD),
    ikd: r.JUMLAH_IKD === null ? null : Number(r.JUMLAH_IKD),
    rekam: r.REKAM_DINAMIS === null ? null : Number(r.REKAM_DINAMIS),
    complete: r.COMPLETE === 1,
  }));
  return {
    code,
    name: (result.rows as any[])?.at(-1)?.WILAYAH ?? name,
    level,
    ...profileSummary(points),
    end,
    methodology:
      "Rekor dan pembanding memakai snapshot lengkap. Tanggal pasangan tampil pada histori. Rata-rata tidak diberi bobot jumlah hari. Grafik #1 berada di atas; tanggal merupakan tanggal upload WIB.",
  };
}
