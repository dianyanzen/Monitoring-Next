// FILE: src/app/api/setting/activityid/[activityId]/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execOne, execDml, withTransaction } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
const AT = "/api/setting/activityid/[activityId]";

type ActivityDetailRow = {
  ACTIVITY_ID: number;
  ACTIVITY: string | null;
  USER_LEVEL: number;
  LEVEL_NAME: string | null;
};

const parseActivityId = (value: string | null | undefined): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.floor(num);
  return intVal > 0 ? intVal : null;
};

const normalizeActivityName = (value: unknown) =>
  value == null ? "" : String(value).trim().toUpperCase();

async function getActivityRow(id: number) {
  return execOne<ActivityDetailRow>(
    `
    SELECT
      A.ACTIVITY_ID,
      A.ACTIVITY,
      A.USER_LEVEL,
      NVL(L.LEVEL_NAME, '-') AS LEVEL_NAME
    FROM SIAK_ACTIVITY A
    LEFT JOIN SIAK_USER_LEVEL L ON L.USER_LEVEL = A.USER_LEVEL
    WHERE A.ACTIVITY_ID = :b_id
    `,
    { b_id: id },
    {},
    ORACLE_ALIAS
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ activityId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { activityId } = await context.params;
    const id = parseActivityId(activityId);
    if (!id) return badRequest("ID activity tidak valid");

    const row = await getActivityRow(id);
    if (!row) return err("Activity tidak ditemukan", 404);

    const data = {
      activity_id: row.ACTIVITY_ID,
      activity: row.ACTIVITY?.trim() ?? "",
      user_level: row.USER_LEVEL,
      level_name: row.LEVEL_NAME?.trim() ?? "",
    };

    await Log.info({
      scope: "API",
      msg: "activityid/detail",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "activityid/detail_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat detail activity");
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ activityId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { activityId } = await context.params;
    const id = parseActivityId(activityId);
    if (!id) return badRequest("ID activity tidak valid");

    const body = await req.json().catch(() => ({}));
    const activityName =
      normalizeActivityName(body.activity_nm) ||
      normalizeActivityName(body.activity_name) ||
      normalizeActivityName(body.activity);

    if (!activityName) {
      return badRequest("Activity Name tidak boleh kosong", { field: "activity" });
    }

    const existed = await getActivityRow(id);
    if (!existed) return err("Activity tidak ditemukan", 404);

    await execDml(
      `
      UPDATE SIAK_ACTIVITY
      SET ACTIVITY = :b_activity
      WHERE ACTIVITY_ID = :b_id
      `,
      {
        b_id: id,
        b_activity: activityName,
      },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "activityid/update",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ activity_id: id }, "Activity berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "activityid/update_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memperbarui activity");
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ activityId: string }> }
) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { activityId } = await context.params;
    const id = parseActivityId(activityId);
    if (!id) return badRequest("ID activity tidak valid");

    await withTransaction(
      async (conn) => {
        // Backup harian sebelum hapus ( mengikuti legacy sett_backup_daily )
        await conn.execute(
          `
          INSERT INTO SIAK_DAILY_BCK (
            DAILY_ID,
            ACTIVITY_ID,
            USER_ID,
            START_ACTIVITY,
            END_ACTIVITY,
            DESCRIPTION,
            CREATED_BY,
            CREATED_DT,
            NUMBER_ACTIVITY
          )
          SELECT
            B.DAILY_ID,
            B.ACTIVITY_ID,
            B.USER_ID,
            B.START_ACTIVITY,
            B.END_ACTIVITY,
            B.DESCRIPTION,
            B.CREATED_BY,
            B.CREATED_DT,
            B.NUMBER_ACTIVITY
          FROM SIAK_DAILY B
          WHERE NOT EXISTS (
            SELECT 1 FROM SIAK_DAILY_BCK C WHERE C.DAILY_ID = B.DAILY_ID
          )
          `,
          {},
          { autoCommit: false }
        );

        await conn.execute(
          `DELETE FROM SIAK_DAILY WHERE ACTIVITY_ID = :b_id`,
          { b_id: id },
          { autoCommit: false }
        );

        const deleteActivity = await conn.execute(
          `DELETE FROM SIAK_ACTIVITY WHERE ACTIVITY_ID = :b_id`,
          { b_id: id },
          { autoCommit: false }
        );

        if ((deleteActivity.rowsAffected ?? 0) === 0) {
          throw new Error("Activity tidak ditemukan");
        }
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "activityid/delete",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { id },
    });

    return ok({ activity_id: id }, "Activity berhasil dihapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "activityid/delete_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    const message =
      e?.message === "Activity tidak ditemukan"
        ? "Activity tidak ditemukan"
        : e?.message || "Gagal menghapus activity";
    const status = message === "Activity tidak ditemukan" ? 404 : 500;
    return err("Terjadi kesalahan server. Silakan coba lagi.", status);
  }
}
