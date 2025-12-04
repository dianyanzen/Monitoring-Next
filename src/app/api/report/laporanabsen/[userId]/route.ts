// FILE: src/app/api/report/laporanabsen/[userId]/route.ts
import { NextRequest } from "next/server";
import { err, badRequest, unauthorized, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/report/laporanabsen/[userId]";
const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type Row = {
  TANGGAL: string;
  JAM_MASUK: string;
  JAM_KELUAR: string;
  KETERANGAN: string;
  MINUTE_WORK: number;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

function normalizeMonthYear(raw: unknown) {
  const value = toStr(raw);
  if (!value) return null;
  if (/^\d{2}-\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [yyyy, mm] = value.split("-");
    return `${mm}-${yyyy}`;
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: any }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const url = new URL(req.url);
    const period = normalizeMonthYear(url.searchParams.get("period") || url.searchParams.get("tanggal"));
    const userId = toStr((params as any)?.userId);
    if (!period) return badRequest("Format tanggal harus MM-YYYY");
    if (!userId) return badRequest("userId wajib diisi");

    const rows = await execRows<Row>(
      `
      SELECT 
        TO_CHAR(B.TANGGAL,'DD-MM-YYYY') AS TANGGAL,
        B.JAM_MASUK,
        B.JAM_KELUAR,
        B.KETERANGAN,
        ROUND((TO_DATE(B.JAM_KELUAR,'HH24:MI') - TO_DATE(B.JAM_MASUK,'HH24:MI'))*24*60) AS MINUTE_WORK
      FROM SIAK_ABSENSI B
      WHERE B.USER_ID = :b_user_id
        AND TO_CHAR(B.TANGGAL,'MM-YYYY') = :b_period
      ORDER BY B.TANGGAL DESC
      `,
      { b_user_id: userId, b_period: period },
      {},
      ORACLE_ALIAS,
    );

    const data = rows.map((r, idx) => ({
      no: idx + 1,
      tanggal: toStr(r.TANGGAL),
      jamMasuk: toStr(r.JAM_MASUK),
      jamKeluar: toStr(r.JAM_KELUAR),
      keterangan: toStr(r.KETERANGAN),
      menitKerja: `${r.MINUTE_WORK ?? 0} Menit`,
    }));

    await Log.info({
      scope: "API",
      msg: "laporanabsen/detail",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { period, userId, count: data.length },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "laporanabsen/detail_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat detail absensi");
  }
}
