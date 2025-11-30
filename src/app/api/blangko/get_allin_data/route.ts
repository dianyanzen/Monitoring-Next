import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

const SQL = `
  SELECT
    (SELECT NVL(SUM(JUMLAH),0) FROM SIAK_BLANGKO WHERE TRUNC(TANGGAL_MASUK,'YYYY') = TRUNC(SYSDATE,'YYYY')) AS MASUK,
    (SELECT NVL(SUM(AMBIL) - (SUM(RUSAK) +SUM(PENGEMBALIAN)),0) AS JUMLAH FROM SIAK_MONEV_BLANGKO WHERE TRUNC(TANGGAL,'YYYY') = TRUNC(SYSDATE,'YYYY')) AS KELUAR,
    (SELECT NVL(SUM(RUSAK),0) AS JUMLAH FROM SIAK_MONEV_BLANGKO WHERE TRUNC(TANGGAL,'YYYY') = TRUNC(SYSDATE,'YYYY')) AS RUSAK,
    (SELECT NVL(SUM(JUMLAH),0) FROM SIAK_BLANGKO ) - (SELECT NVL(SUM(AMBIL) - SUM(PENGEMBALIAN),0) AS JUMLAH FROM SIAK_MONEV_BLANGKO) AS SISA
  FROM DUAL
`;

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const rows = await execRows(SQL, {}, {}, ORACLE_ALIAS);
    const payload = rows?.[0] ?? { MASUK: 0, KELUAR: 0, RUSAK: 0, SISA: 0 };

    await Log.info({
      scope: "API",
      msg: "blangko/get_allin_data",
      at: "/api/blangko/get_allin_data",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: payload,
    });

    return ok(payload);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/get_allin_data_err",
      at: "/api/blangko/get_allin_data",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat data blangko", 500);
  }
}
