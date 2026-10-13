// FILE: src/app/api/wilayah/kelurahan/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, badRequest, err } from "@/lib/http";
import { execRows } from "@/lib/db";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lock ke ENV (Bandung default: 32 / 73)
const NO_PROP = (process.env.NO_PROP ?? "32").trim();
const NO_KAB = (process.env.NO_KAB ?? "73").trim();

type Row = {
  NO_PROP: string | number | null;
  NO_KAB: string | number | null;
  NO_KEC: string | number | null;
  NO_KEL: string | number | null;
  NAMA_KEL: string | null;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const noKec = (searchParams.get("no_kec") ?? "").trim();
    if (!noKec) return badRequest("Parameter no_kec wajib diisi");

    const sql = `
      SELECT NO_PROP, NO_KAB, NO_KEC, NO_KEL, NAMA_KEL
      FROM SETUP_KEL
      WHERE NO_PROP = :b_prop
        AND NO_KAB = :b_kab
        AND NO_KEC = :b_kec
      ORDER BY TO_NUMBER(NO_KEL)
    `;

    const rows = await execRows<Row>(
      sql,
      { b_prop: NO_PROP, b_kab: NO_KAB, b_kec: noKec },
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((r) => ({
      no_prop: toStr(r.NO_PROP),
      no_kab: toStr(r.NO_KAB),
      no_kec: toStr(r.NO_KEC),
      no_kel: toStr(r.NO_KEL),
      nama_kel: toStr(r.NAMA_KEL),
    }));

    return ok(data, "OK", data.length);
  } catch (e: any) {
    return err("Gagal memuat daftar kelurahan");
  }
}
