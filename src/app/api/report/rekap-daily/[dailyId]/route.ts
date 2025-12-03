import { NextRequest } from "next/server";
import { badRequest, err, forbidden, ok, unauthorized } from "@/lib/http";
import { execDml, execOne } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/rekap-daily/[dailyId]";

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());
const parseId = (v: string | null | undefined) => {
  const num = Number(v);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.floor(num);
  return intVal > 0 ? intVal : null;
};

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ dailyId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { dailyId } = await context.params;
    const id = parseId(dailyId);
    if (!id) return badRequest("ID daily report tidak valid");

    const ownerRow = await execOne<{ USER_ID?: string }>(
      "SELECT USER_ID FROM SIAK_DAILY WHERE DAILY_ID = :b_id",
      { b_id: id },
      {},
      ORACLE_ALIAS
    );
    if (!ownerRow) return err("Daily report tidak ditemukan", 404);

    const owner = toStr(ownerRow.USER_ID);
    const requester = toStr(session.S_USER_ID);
    if (owner && requester && owner !== requester) {
      return forbidden("Daily report bukan milik Anda");
    }

    const affected = await execDml(
      "DELETE FROM SIAK_DAILY WHERE DAILY_ID = :b_id AND USER_ID = :b_user",
      { b_id: id, b_user: owner || requester },
      {},
      ORACLE_ALIAS
    );
    if (!affected) return err("Daily report tidak ditemukan", 404);

    await Log.info({
      scope: "API",
      msg: "rekap-daily/delete",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ daily_id: id }, "Daily report berhasil dihapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "rekap-daily/delete_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menghapus daily report");
  }
}
