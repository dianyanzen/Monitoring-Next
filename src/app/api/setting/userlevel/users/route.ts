// FILE: src/app/api/setting/userlevel/users/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type RawUser = {
  USER_ID: string;
  NAMA_LGKP: string;
  NIK: string;
  TMPT_LHR: string | null;
  TGL_LHR: string | null;
  JENIS_KLMIN: number | null;
  NAMA_KANTOR: string | null;
  TELP: string | null;
  ALAMAT_RUMAH: string | null;
  USER_LEVEL: number;
  IS_ACTIVE: number | null;
};

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const toISO = (d: unknown): string | null => {
  if (!d) return null;
  try {
    const dt = typeof d === "string" ? new Date(d) : (d as Date);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  } catch { return null; }
};

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const url = new URL(req.url);
    const codeRaw = (url.searchParams.get("code") ?? "").trim();
    const code = onlyDigits(codeRaw);
    if (!code) return badRequest("Parameter 'code' wajib diisi");

    const rows = await execRows<RawUser>(
      `
      SELECT
        USER_ID,
        NAMA_LGKP,
        NIK,
        TMPT_LHR,
        TO_CHAR(TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
        JENIS_KLMIN,
        NAMA_KANTOR,
        TELP,
        ALAMAT_RUMAH,
        USER_LEVEL,
        IS_ACTIVE
      FROM SIAK_USER_PLUS
      WHERE USER_LEVEL = :b_code
      ORDER BY NAMA_LGKP
      `,
      { b_code: code },
      {},
      ORACLE_ALIAS
    );

    const list = (Array.isArray(rows) ? rows : []).map((r) => ({
      user_id: r.USER_ID,
      nama_lgkp: r.NAMA_LGKP,
      nik: r.NIK,
      tmpt_lhr: r.TMPT_LHR ?? null,
      tgl_lhr: r.TGL_LHR ?? null,
      jenis_klmin: r.JENIS_KLMIN ?? null,
      nama_kantor: r.NAMA_KANTOR ?? null,
      telp: r.TELP ?? null,
      alamat_rumah: r.ALAMAT_RUMAH ?? null,
      user_level: r.USER_LEVEL,
      is_active: Number(r.IS_ACTIVE ?? 0) !== 0,
    }));

    return ok({ data: list });
  } catch (e: any) {
    return err("Gagal memuat daftar pengguna untuk user level");
  }
}
