// FILE: src/app/api/setting/activityid/groups/route.ts
import { ok, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type GroupRow = {
  USER_LEVEL: number;
  LEVEL_NAME: string | null;
};

export async function GET() {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const rows = await execRows<GroupRow>(
      `
      SELECT USER_LEVEL, LEVEL_NAME
      FROM SIAK_ACTIVITY_LEVEL
      ORDER BY USER_LEVEL
      `,
      {},
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((row) => ({
      user_level: Number(row.USER_LEVEL),
      level_name: row.LEVEL_NAME ? String(row.LEVEL_NAME).trim() : "",
    }));

    await Log.info({
      scope: "API",
      msg: "activityid/groups",
      at: "/api/setting/activityid/groups",
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: data.length },
    });

    return ok({ rows: data }, "Daftar group activity");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "activityid/groups_err",
      at: "/api/setting/activityid/groups",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat group activity");
  }
}

