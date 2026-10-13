import { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execDml } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/absensi-v/[dailyId]/reject";

export async function POST(req: NextRequest, context: { params: Promise<{ dailyId: string }> }) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const params = await context.params;
    const dailyId = Number(params?.dailyId ?? 0);
    if (!dailyId || Number.isNaN(dailyId)) {
      return badRequest("Daily ID tidak valid");
    }

    const body = await req.json().catch(() => ({}));
    const message = (body?.message || "").toString().trim();
    if (!message || message.length < 10) {
      return badRequest("Isi pesan minimal 10 karakter");
    }

    const rows = await execDml(
      `
      UPDATE SIAK_DAILY A
      SET A.IS_VALID = 2
      WHERE A.DAILY_ID = :b_daily_id
        AND A.IS_VALID = 0
        AND A.USER_ID <> :b_user
        AND EXISTS (
          SELECT 1
          FROM SIAK_USER_PLUS U
          WHERE U.USER_ID = A.USER_ID
            AND U.VERIVIKATOR = :b_user
        )
      `,
      { b_daily_id: dailyId, b_user: session.S_USER_ID },
      {},
      ORACLE_ALIAS
    );

    if (!rows) {
      return err("Data tidak ditemukan atau bukan kewenangan Anda", 400);
    }

    await Log.info({
      scope: "API",
      msg: "absensi-v/reject",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { dailyId, rows, note: message.slice(0, 120) },
    });

    return ok({ rows }, "Aktivitas ditolak");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "absensi-v/reject_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal menolak aktivitas");
  }
}
