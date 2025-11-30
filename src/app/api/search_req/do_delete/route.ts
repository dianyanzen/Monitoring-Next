import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execDml } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { buildInClause, sanitizeNikList } from "@/app/api/req/ektp/perubahan/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const nikRaw = (body.nikList ?? body.niks ?? body.nik ?? "") as string;
    const nikList = sanitizeNikList(nikRaw).slice(0, 1000);
    if (!nikList.length) return badRequest("NIK wajib diisi.");

    const { clause, binds } = buildInClause(nikList, "nik");

    const SQL = `DELETE FROM SIAK_REQ_CETAK_KTP@YZDB WHERE STEP_PROC <> 'C' AND NIK IN (${clause})`;
    const affected = await execDml(SQL, binds, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "search_req/do_delete",
      at: "/api/search_req/do_delete",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { requested: nikList.length, affected },
    });

    return ok({ affected }, affected > 0 ? "Pengajuan berhasil dihapus" : "Tidak ada data yang dihapus");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "search_req/do_delete_err",
      at: "/api/search_req/do_delete",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal menghapus pengajuan", 500);
  }
}
