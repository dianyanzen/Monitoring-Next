import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { hasIkdRankingAccess } from "../access";
import { snapshotDate } from "../snapshots";
import { noStore } from "../request";
import { badRequest, err, forbidden, ok, unauthorized } from "@/lib/http";
import { Log } from "@/lib/log";
import {
  rankingAnalysis,
  rankingProfile,
  rankingSnapshots,
  RankingInputError,
} from "./repository";
import type { Level, League } from "./analytics";
export async function ikdRead(
  request: NextRequest,
  kind: string,
  code?: string,
) {
  const started = Date.now();
  try {
    const user = await readServerSession();
    if (!user) return noStore(unauthorized());
    if (!(await hasIkdRankingAccess(user.S_USER_LEVEL)))
      return noStore(forbidden());
    const q = request.nextUrl.searchParams;
    let dateA: string | null, dateB: string | null, end: string | null;
    try {
      dateA = q.get("a") === "none" ? null : snapshotDate(q.get("a"));
      dateB = snapshotDate(q.get("b"));
      end = snapshotDate(q.get("end"));
    } catch {
      return noStore(badRequest("Tanggal snapshot tidak valid."));
    }
    let data: any;
    if (kind === "snapshots")
      data = await rankingSnapshots().then((r) => ({
        snapshots: r.snapshots,
        timeZone: "Asia/Jakarta",
      }));
    else if (kind === "region") data = await rankingProfile(code!, end);
    else {
      const level = q.get("level") || "village",
        league = q.get("league") || "ALL";
      if (
        !["village", "district"].includes(level) ||
        !["ALL", "SMALL", "MEDIUM", "LARGE", "UNKNOWN"].includes(league)
      )
        return noStore(badRequest("Level atau liga tidak valid."));
      if (level === "district" && league !== "ALL")
        return noStore(
          badRequest("Liga ukuran hanya berlaku untuk kelurahan."),
        );
      const result = await rankingAnalysis({
        level: level as Level,
        league: league as League,
        dateA,
        dateB,
        noBaseline: q.get("a") === "none",
      });
      data =
        kind === "highlights"
          ? {
              dateA: result.dateA,
              dateB: result.dateB,
              comparable: result.comparable,
              highlights: result.highlights,
              warning: result.warning,
            }
          : kind === "stats"
            ? {
                dateA: result.dateA,
                dateB: result.dateB,
                city: result.city,
                cityTrend: result.cityTrend,
                qualityA: result.qualityA,
                qualityB: result.qualityB,
              }
            : result;
      if (kind === "movement")
        data = {
          ...result,
          rows: [...result.rows].sort(
            (a, b) =>
              (b.rankChange ?? -Infinity) - (a.rankChange ?? -Infinity) ||
              a.code.localeCompare(b.code),
          ),
        };
    }
    await Log.info({
      scope: "API",
      msg: "pdak/ikd/" + kind,
      user: user.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { kind },
    }).catch(() => {});
    return noStore(ok(data));
  } catch (e) {
    if (e instanceof RankingInputError) return noStore(badRequest(e.message));
    await Log.error({
      scope: "API",
      msg: "pdak/ikd/read_error",
      tookMs: Date.now() - started,
      err: { name: "IkdReadError", message: "Analitik IKD gagal dimuat." },
    }).catch(() => {});
    return noStore(
      err("Analitik IKD belum dapat dimuat. Silakan coba kembali.", 503),
    );
  }
}
