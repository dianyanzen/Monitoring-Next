// FILE: src/app/api/wilayah/kabupaten/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Di-lock ke ENV (default 32 / 73 kalau ENV belum di-set)
const NO_PROP = (process.env.NO_PROP ?? "32").trim();
const NO_KAB = (process.env.NO_KAB ?? "73").trim();

type Row = {
  NO_PROP: string | number | null;
  NO_KAB: string | number | null;
  NAMA_KAB: string | null;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const sql = `
      SELECT NO_PROP, NO_KAB, NAMA_KAB
      FROM SETUP_KAB
      WHERE NO_PROP = :b_prop
        AND NO_KAB = :b_kab
      ORDER BY NO_KAB
    `;
    const binds = {
      b_prop: NO_PROP,
      b_kab: NO_KAB,
    };

    const rows = await execRows<Row>(sql, binds, {}, ORACLE_ALIAS);

    const data = rows.map((r) => ({
      no_prop: toStr(r.NO_PROP),
      no_kab: toStr(r.NO_KAB),
      nama_kab: toStr(r.NAMA_KAB),
    }));

    return ok(data, "OK", data.length);
  } catch (e: any) {
    return err(e?.message || "Gagal memuat daftar kabupaten/kota");
  }
}
