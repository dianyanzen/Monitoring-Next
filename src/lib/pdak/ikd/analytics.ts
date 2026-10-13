export type Level = "district" | "village";
export type League = "ALL" | "SMALL" | "MEDIUM" | "LARGE" | "UNKNOWN";
export type IkdRow = {
  date: string;
  code: string;
  name: string;
  rekam: number | null;
  ikd: number | null;
  coverage: number | null;
};
export type RankedRow = IkdRow & { rank: number | null; league: League };
export type RankingRow = RankedRow & {
  previousRank: number | null;
  leagueRank: number | null;
  previousLeagueRank: number | null;
  rankChange: number | null;
  leagueRankChange: number | null;
  ikdAdded: number | null;
  coverageAdded: number | null;
  growth: number | null;
  velocity: number | null;
  baselineStatus: string;
  leagueChanged: boolean;
};
const numberOK = (v: number | null) =>
  v !== null && Number.isFinite(v) && v >= 0;
const countOK = (v: number | null) => numberOK(v) && Number.isSafeInteger(v);
export const coverageOK = (v: number | null) => numberOK(v) && v! <= 100;
export const regionLevel = (code: string): Level | null =>
  /^\d{2}\.\d{2}\.\d{2}$/.test(code)
    ? "district"
    : /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(code)
      ? "village"
      : null;
export function sizeLeague(value: number | null): League {
  return !countOK(value)
    ? "UNKNOWN"
    : value! <= 10000
      ? "SMALL"
      : value! < 15000
        ? "MEDIUM"
        : "LARGE";
}
export function rankRows(rows: IkdRow[], level: Level): RankedRow[] {
  const scoped = rows.filter((r) => regionLevel(r.code) === level);
  const codes = new Set<string>();
  for (const row of scoped) {
    if (codes.has(row.code)) throw new Error("DUPLICATE_REGION");
    codes.add(row.code);
  }
  const sorted = [...scoped].sort(
    (a, b) =>
      (coverageOK(b.coverage) ? b.coverage! : -1) -
        (coverageOK(a.coverage) ? a.coverage! : -1) ||
      a.code.localeCompare(b.code),
  );
  let rank = 0,
    last: number | null = null;
  return sorted.map((r, i) => {
    if (coverageOK(r.coverage) && r.coverage !== last) {
      rank = i + 1;
      last = r.coverage;
    }
    return {
      ...r,
      rank: coverageOK(r.coverage) ? rank : null,
      league: level === "village" ? sizeLeague(r.rekam) : "ALL",
    };
  });
}
export function completeness(rows: IkdRow[], reference: string[]) {
  const expected = new Set(reference),
    codes = new Set(rows.map((r) => r.code));
  const counts = {
    city: rows.filter((r) => /^\d{2}\.\d{2}$/.test(r.code)).length,
    district: rows.filter((r) => regionLevel(r.code) === "district").length,
    village: rows.filter((r) => regionLevel(r.code) === "village").length,
  };
  const missing = reference.filter((c) => !codes.has(c)),
    unexpected = [...codes].filter((c) => !expected.has(c));
  const invalid = rows
    .filter((r) => !coverageOK(r.coverage))
    .map((r) => r.code);
  return {
    complete:
      reference.length === 182 &&
      rows.length === 182 &&
      codes.size === 182 &&
      !missing.length &&
      !unexpected.length &&
      !invalid.length &&
      counts.city === 1 &&
      counts.district === 30 &&
      counts.village === 151,
    counts,
    total: rows.length,
    missing,
    unexpected,
    invalid,
  };
}
function cohortRanks(rows: RankedRow[], codes: Set<string>) {
  const cohort = rows
    .filter((r) => codes.has(r.code))
    .sort(
      (a, b) =>
        (coverageOK(b.coverage) ? b.coverage! : -1) -
          (coverageOK(a.coverage) ? a.coverage! : -1) ||
        a.code.localeCompare(b.code),
    );
  let rank = 0,
    last: number | null = null;
  return new Map(
    cohort.map((r, i) => {
      if (coverageOK(r.coverage) && r.coverage !== last) {
        rank = i + 1;
        last = r.coverage;
      }
      return [r.code, coverageOK(r.coverage) ? rank : null];
    }),
  );
}
export function calendarDays(a: string, b: string) {
  return (
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000
  );
}
export function compareSnapshots(
  a: IkdRow[],
  b: IkdRow[],
  level: Level,
  reference: string[],
  dateA: string | null,
  dateB: string | null,
) {
  const qualityA = dateA ? completeness(a, reference) : null,
    qualityB = completeness(b, reference);
  const days = dateA && dateB ? calendarDays(dateA, dateB) : null;
  const comparable =
    !!qualityA?.complete && qualityB.complete && days !== null && days > 0;
  const known = new Set(reference);
  const previous = rankRows(
      a.filter((r) => known.has(r.code)),
      level,
    ),
    current = rankRows(
      b.filter((r) => known.has(r.code)),
      level,
    ),
    byCode = new Map(previous.map((r) => [r.code, r]));
  const currentLeagues = new Map<League, Map<string, number | null>>(),
    previousLeagues = new Map<League, Map<string, number | null>>();
  for (const league of ["SMALL", "MEDIUM", "LARGE"] as League[]) {
    const codes = new Set(
      current.filter((r) => r.league === league).map((r) => r.code),
    );
    currentLeagues.set(league, cohortRanks(current, codes));
    previousLeagues.set(league, cohortRanks(previous, codes));
  }
  const rows: RankingRow[] = current.map((r) => {
    const old = byCode.get(r.code),
      pair = !!old && days !== null && days > 0;
    const ikdAdded =
      pair && countOK(r.ikd) && countOK(old!.ikd) ? r.ikd! - old!.ikd! : null;
    const coverageAdded =
      pair && coverageOK(r.coverage) && coverageOK(old!.coverage)
        ? Math.round((r.coverage! - old!.coverage!) * 10000) / 10000
        : null;
    const leagueRank = currentLeagues.get(r.league)?.get(r.code) ?? null;
    const previousLeagueRank = comparable
      ? (previousLeagues.get(r.league)?.get(r.code) ?? null)
      : null;
    return {
      ...r,
      previousRank: comparable ? (old?.rank ?? null) : null,
      leagueRank,
      previousLeagueRank,
      rankChange:
        comparable &&
        old?.rank !== null &&
        old?.rank !== undefined &&
        r.rank !== null
          ? old.rank - r.rank
          : null,
      leagueRankChange:
        comparable && previousLeagueRank !== null && leagueRank !== null
          ? previousLeagueRank - leagueRank
          : null,
      ikdAdded,
      coverageAdded,
      growth:
        ikdAdded !== null && old!.ikd! > 0
          ? (ikdAdded / old!.ikd!) * 100
          : null,
      velocity: ikdAdded !== null ? ikdAdded / days! : null,
      baselineStatus: !old
        ? "NO_BASELINE"
        : !countOK(old.ikd)
          ? "INVALID_BASELINE"
          : old.ikd === 0
            ? "NEW_BASELINE"
            : "OK",
      leagueChanged:
        !!old && level === "village" && sizeLeague(old.rekam) !== r.league,
    };
  });
  return {
    dateA,
    dateB,
    days,
    level,
    comparable,
    qualityA,
    qualityB,
    rows,
    city: b.find((r) => /^\d{2}\.\d{2}$/.test(r.code)) ?? null,
    warning: !dateB
      ? "Belum ada snapshot IKD."
      : !dateA
        ? "Snapshot pembanding belum tersedia atau belum dipilih; perubahan belum dapat dihitung."
        : !comparable
          ? "Snapshot tidak lengkap atau tidak sebanding. Perubahan peringkat dan penghargaan periode dinonaktifkan."
          : null,
    methodology:
      "Peringkat berdasarkan PERSEN_IKD tersimpan. Nilai seri mendapat peringkat sama (1, 1, 3); urutan tampilan memakai KODE. Liga A/B memakai kelompok ukuran snapshot B. Jeda hari mengikuti tanggal upload WIB.",
  };
}
export function highlights(rows: RankingRow[], comparable: boolean) {
  const winners = (
    metric: keyof RankingRow,
    direction: 1 | -1,
    positive = false,
  ) => {
    const candidates = rows.filter(
      (r) =>
        typeof r[metric] === "number" &&
        Number.isFinite(r[metric] as number) &&
        (!positive || (r[metric] as number) * direction > 0),
    );
    if (!candidates.length) return null;
    const value =
      candidates.reduce(
        (best, r) => Math.max(best, (r[metric] as number) * direction),
        -Infinity,
      ) * direction;
    return {
      value,
      regions: candidates
        .filter((r) => r[metric] === value)
        .map((r) => ({ code: r.code, name: r.name, rank: r.rank })),
    };
  };
  return {
    topRanked: winners("coverage", 1),
    biggestClimber: comparable ? winners("rankChange", 1, true) : null,
    biggestDrop: comparable ? winners("rankChange", -1, true) : null,
    mostAdded: comparable ? winners("ikdAdded", 1, true) : null,
    biggestGrowth: comparable ? winners("growth", 1, true) : null,
    mostImprovedCoverage: comparable ? winners("coverageAdded", 1, true) : null,
    fastestVelocity: comparable ? winners("velocity", 1, true) : null,
  };
}
export function profileHistory(
  code: string,
  snapshots: IkdRow[][],
  reference: string[],
) {
  const level = regionLevel(code);
  if (!level) throw new Error("INVALID_REGION");
  const points = snapshots
    .map((rows) => {
      const q = completeness(rows, reference),
        r = rankRows(rows, level).find((r) => r.code === code);
      return {
        date: rows[0]?.date ?? "",
        rank: q.complete ? (r?.rank ?? null) : null,
        coverage: r?.coverage ?? null,
        ikd: r?.ikd ?? null,
        rekam: r?.rekam ?? null,
        complete: q.complete,
      };
    })
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { code, level, ...profileSummary(points) };
}
export type HistoryPoint = {
  date: string;
  rank: number | null;
  coverage: number | null;
  ikd: number | null;
  rekam: number | null;
  complete: boolean;
};
export function profileSummary(points: HistoryPoint[]) {
  const valid = points.filter((p) => p.complete && p.rank !== null);
  const moves = valid.slice(1).map((p, i) => valid[i].rank! - p.rank!);
  const ranks = valid.map((p) => p.rank!);
  const latest = points.at(-1),
    previous = [...valid].reverse().find((p) => latest && p.date < latest.date);
  return {
    points,
    currentRank: latest?.complete ? latest.rank : null,
    previousRank: previous?.rank ?? null,
    previousDate: previous?.date ?? null,
    highestRank: ranks.length ? Math.min(...ranks) : null,
    lowestRank: ranks.length ? Math.max(...ranks) : null,
    averageRank: ranks.length
      ? ranks.reduce((a, b) => a + b, 0) / ranks.length
      : null,
    biggestClimb: valid.length > 1 ? Math.max(0, ...moves) : null,
    biggestFall: valid.length > 1 ? Math.max(0, ...moves.map((m) => -m)) : null,
    validSnapshots: ranks.length,
  };
}
