// FILE: src/app/api/setting/activityid/route.ts
import type { NextRequest } from "next/server";
import { ok, err, badRequest, unauthorized } from "@/lib/http";
import { execRows, execOne, execDml } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type ActivityRow = {
  ACTIVITY_ID: number;
  ACTIVITY: string | null;
  USER_LEVEL: number;
  LEVEL_NAME: string | null;
};

const toStringSafe = (value: unknown) => (value == null ? "" : String(value).trim());

const parseGroupId = (value: string | null): number | null => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return null;
  const intVal = Math.floor(num);
  return intVal > 0 ? intVal : null;
};

const normalizeActivityName = (value: unknown) => toStringSafe(value).toUpperCase();

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const groupId =
      parseGroupId(searchParams.get("group_id")) ??
      parseGroupId(searchParams.get("user_level")) ??
      parseGroupId(searchParams.get("level"));

    const rows = await execRows<ActivityRow>(
      `
      SELECT
        A.ACTIVITY_ID,
        A.ACTIVITY,
        A.USER_LEVEL,
        NVL(L.LEVEL_NAME, '-') AS LEVEL_NAME
      FROM SIAK_ACTIVITY A
      LEFT JOIN SIAK_USER_LEVEL L ON L.USER_LEVEL = A.USER_LEVEL
      WHERE (:b_group_id IS NULL OR A.USER_LEVEL = :b_group_id)
      ORDER BY NVL(L.LEVEL_NAME, 'ZZZ'), A.ACTIVITY
      `,
      { b_group_id: groupId },
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((row) => ({
      activity_id: Number(row.ACTIVITY_ID),
      activity: toStringSafe(row.ACTIVITY),
      user_level: Number(row.USER_LEVEL),
      level_name: toStringSafe(row.LEVEL_NAME),
    }));

    await Log.info({
      scope: "API",
      msg: "activityid/list",
      at: "/api/setting/activityid",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { groupId, count: data.length },
    });

    return ok(
      {
        rows: data,
        total: data.length,
        filter: { group_id: groupId },
      },
      "Daftar activity berhasil dimuat"
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "activityid/list_err",
      at: "/api/setting/activityid",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat daftar activity");
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const activityName =
      normalizeActivityName(body.activity_nm) ||
      normalizeActivityName(body.activity_name) ||
      normalizeActivityName(body.activity);
    const groupId =
      parseGroupId(body.user_level?.toString?.()) ??
      parseGroupId(body.group_id?.toString?.()) ??
      parseGroupId(body.kdgroup?.toString?.());

    if (!activityName) {
      return badRequest("Activity Name tidak boleh kosong", { field: "activity" });
    }
    if (!groupId) {
      return badRequest("Group User wajib dipilih", { field: "user_level" });
    }

    const next = await execOne<{ NEXT_ID?: number }>(
      `SELECT ACTIVITY_ID.NEXTVAL AS NEXT_ID FROM DUAL`,
      {},
      {},
      ORACLE_ALIAS
    );
    const activityId = Number(next?.NEXT_ID ?? 0);

    await execDml(
      `
      INSERT INTO SIAK_ACTIVITY (ACTIVITY_ID, USER_LEVEL, ACTIVITY, CREATED_DT, CREATED_BY)
      VALUES (:b_id, :b_level, :b_activity, SYSDATE, :b_created_by)
      `,
      {
        b_id: activityId,
        b_level: groupId,
        b_activity: activityName,
        b_created_by: session.S_USER_ID,
      },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "activityid/create",
      at: "/api/setting/activityid",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { activityId, groupId },
    });

    return ok(
      { activity_id: activityId },
      "Activity baru berhasil ditambahkan"
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "activityid/create_err",
      at: "/api/setting/activityid",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan activity baru");
  }
}

