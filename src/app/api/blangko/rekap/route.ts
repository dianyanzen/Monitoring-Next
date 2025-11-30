import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

const todayDMY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

function normalizeDMY(input?: string | null) {
  if (!input) return null;
  const t = input.trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split("-");
    return `${d}-${m}-${y}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const rawRange = (body.tanggal ?? body.range ?? "") as string;
    let start = normalizeDMY(body.start) ?? todayDMY();
    let end = normalizeDMY(body.end) ?? start;

    if (rawRange) {
      const m = rawRange.match(/(\d{2}-\d{2}-\d{4})\s*-\s*(\d{2}-\d{2}-\d{4})/);
      if (m) {
        start = m[1];
        end = m[2];
      }
    }

    if (!/^\d{2}-\d{2}-\d{4}$/.test(start) || !/^\d{2}-\d{2}-\d{4}$/.test(end)) {
      return badRequest("Rentang tanggal tidak valid (DD-MM-YYYY).");
    }

    const SQL = `
      SELECT
        A.NO_WIL,
        A.NAMA_WIL,
        NVL(B.AMBIL,0) AS AMBIL,
        NVL(B.RUSAK,0) AS RUSAK,
        NVL(B.PENGEMBALIAN,0) AS PENGEMBALIAN,
        NVL(B.TOTAL,0) AS TOTAL
      FROM SIAK_KODE_WIL A
      LEFT JOIN (
        SELECT
          NO_KEC,
          SUM(AMBIL) AS AMBIL,
          SUM(RUSAK) AS RUSAK,
          SUM(PENGEMBALIAN) AS PENGEMBALIAN,
          SUM(AMBIL) - (SUM(RUSAK)+SUM(PENGEMBALIAN)) AS TOTAL
        FROM SIAK_MONEV_BLANGKO
        WHERE TANGGAL >= TO_DATE(:b_start,'DD-MM-YYYY')
          AND TANGGAL < TO_DATE(:b_end,'DD-MM-YYYY') + 1
        GROUP BY NO_KEC
      ) B ON A.NO_WIL = B.NO_KEC
      ORDER BY A.NO_WIL
    `;

    const rows = await execRows(SQL, { b_start: start, b_end: end }, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/rekap",
      at: "/api/blangko/rekap",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { start, end, total: rows.length },
    });

    return ok({ items: rows, count: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/rekap_err",
      at: "/api/blangko/rekap",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat rekap blangko", 500);
  }
}
