// FILE: src/app/api/wilayah/provinsi/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Di-lock ke ENV (default 32 kalau ENV belum di-set)
const NO_PROP = (process.env.NO_PROP ?? "32").trim();

type Row = {
  NO_PROP: string | number | null;
  NAMA_PROP: string | null;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const sql = `
      SELECT NO_PROP, NAMA_PROP
      FROM SETUP_PROP
      WHERE NO_PROP = :b_prop
      ORDER BY NO_PROP
    `;
    const binds = { b_prop: NO_PROP };

    const rows = await execRows<Row>(sql, binds, {}, ORACLE_ALIAS);

    const data = rows.map((r) => ({
      no_prop: toStr(r.NO_PROP),
      nama_prop: toStr(r.NAMA_PROP),
    }));

    return ok(data, "OK", data.length);
  } catch (e: any) {
    return err(e?.message || "Gagal memuat daftar provinsi");
  }
}
