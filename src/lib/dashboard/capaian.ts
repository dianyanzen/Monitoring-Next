export type CapaianRow = {
  key: string;
  title: string;
  date: string | null;
  realisasi: number | null;
  coverage: number | null;
  target: number | null;
  targetCoverage: number | null;
  progress: number | null;
  denominator: number | null;
  source: string;
};
export const CAPAIAN_SOURCES = [
  {
    key: "rekam",
    title: "Perekaman KTP-el",
    table: "PDAK_PEREKAMAN_KTPL",
    count: "PROGRES_REKAM",
    percent: "PROGRES_PERSENTASE",
    denominator: "WKTP_DINAMIS",
    target: "REKAM",
  },
  {
    key: "kia",
    title: "Kartu Identitas Anak (KIA)",
    table: "PDAK_KIA",
    count: "MEMILIKI_DINAMIS_JML",
    percent: "PERSEN_DINAMIS_PERSEN",
    denominator: "JUMLAH_DINAMIS_TTL",
    target: "KIA",
  },
  {
    key: "akta",
    title: "Akta Kelahiran 0–4 Tahun",
    table: "PDAK_AKTA_KELAHIRAN_04",
    count: "MEMILIKI_DINAMIS_JML",
    percent: "PERSEN_DINAMIS_PERSEN",
    denominator: "WAJIB_AKTA_DINAMIS_JML",
    target: "AKTE_LHR",
  },
  {
    key: "ikd",
    title: "Identitas Kependudukan Digital (IKD)",
    table: "PDAK_IKD",
    count: "JUMLAH_IKD",
    percent: "PERSEN_IKD",
    denominator: "REKAM_DINAMIS",
    target: "IKD",
  },
] as const;
export function validNumber(value: unknown, percentage = false): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && (!percentage || n <= 100) ? n : null;
}
export function capaianRow(
  source: (typeof CAPAIAN_SOURCES)[number],
  raw: Record<string, unknown> | undefined,
  targets: Record<string, unknown>,
): CapaianRow {
  const realisasi = validNumber(raw?.REALISASI),
    target = validNumber(targets[`TARGET_${source.target}_R`]);
  return {
    key: source.key,
    title: source.title,
    date: typeof raw?.SNAPSHOT_DATE === "string" ? raw.SNAPSHOT_DATE : null,
    realisasi,
    coverage: validNumber(raw?.COVERAGE, true),
    denominator: validNumber(raw?.DENOMINATOR),
    target,
    targetCoverage: validNumber(targets[`TARGET_${source.target}_P`], true),
    progress:
      realisasi !== null && target !== null && target > 0
        ? (realisasi / target) * 100
        : null,
    source: source.table,
  };
}
