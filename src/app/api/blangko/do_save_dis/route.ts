import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execDml } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BLANGKO ?? process.env.DB_ALIAS_PRR ?? "DB222";

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const noKec = Number(body.no_kec ?? 0) || 0;
    const tanggal = String(body.tanggal ?? body.tanggal_dis ?? "").trim(); // DD-MM-YYYY
    const penerima = String(body.penerima ?? "").trim().toUpperCase();
    const userName = session.S_USER_ID || "SYSTEM";

    if (!noKec) return badRequest("Kecamatan wajib dipilih.");
    if (!penerima) return badRequest("Penerima wajib diisi.");
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tanggal)) return badRequest("Tanggal tidak valid (DD-MM-YYYY).");

    const sql = `
      INSERT INTO SIAK_DISTRIBUSI_KEPING (NO_KEC, PENERIMA, UPDATE_DT, UPDATE_BY)
      VALUES (:no_kec, :penerima, TO_DATE(:tgl,'DD-MM-YYYY'), :user_name)
    `;

    const affected = await execDml(sql, { no_kec: noKec, penerima, tgl: tanggal, user_name: userName }, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/do_save_dis",
      at: "/api/blangko/do_save_dis",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { affected, noKec, penerima, tanggal },
    });

    return ok({ affected }, "Distribusi keping berhasil disimpan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/do_save_dis_err",
      at: "/api/blangko/do_save_dis",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal menyimpan distribusi", 500);
  }
}
