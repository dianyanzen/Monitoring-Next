import { err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession, getClientInfo } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/absensi-vr/users";

type UserRow = {
  USER_ID: string;
  NAMA_LGKP: string;
  NRP?: string;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET() {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const rows = await execRows<UserRow>(
      `
      SELECT USER_ID, NAMA_LGKP, NRP
      FROM SIAK_USER_PLUS
      ORDER BY NAMA_LGKP
      `,
      {},
      {},
      ORACLE_ALIAS
    );

    const items = rows.map((r) => ({
      id: toStr(r.USER_ID),
      label: `${toStr(r.NAMA_LGKP)}${r.NRP ? ` (${toStr(r.NRP)})` : ""}`,
    }));

    await Log.info({
      scope: "API",
      msg: "absensi-vr/users",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: items.length },
    });

    return ok({ items });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "absensi-vr/users_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat daftar petugas");
  }
}

