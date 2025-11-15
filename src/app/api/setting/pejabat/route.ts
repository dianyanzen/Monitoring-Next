// FILE: src/app/api/setting/pejabat/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, err } from "@/lib/http";
import { execRows } from "@/lib/db";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PejabatRow = {
  PEJABAT_ID: number;
  NIP: string | number | null;
  NAMA: string | null;
  JABATAN: string | null;
  IS_STRUKTURAL: number | string | null;
};

const toStr = (v: unknown) => (v == null ? "" : String(v).trim());

export async function GET(req: NextRequest) {
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const { searchParams } = new URL(req.url);
    const nama = (searchParams.get("nama") ?? "").trim();
    const nip = (searchParams.get("nip") ?? "").trim();
    const limitParam = Number(searchParams.get("limit") ?? "");
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), 200)
        : 100;

    const filters: string[] = [];
    const binds: Record<string, unknown> = { b_limit: limit };

    if (nama) {
      filters.push("UPPER(NAMA) LIKE :b_nama");
      binds.b_nama = `%${nama.toUpperCase()}%`;
    }
    if (nip) {
      filters.push("NIP LIKE :b_nip");
      binds.b_nip = `%${nip}%`;
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const rows = await execRows<PejabatRow>(
      `
      SELECT *
      FROM (
        SELECT
          PEJABAT_ID,
          NIP,
          NAMA,
          JABATAN,
          IS_STRUKTURAL,
          ROW_NUMBER() OVER (ORDER BY NVL(IS_STRUKTURAL,0) DESC, NAMA) AS RN
        FROM SIAK_PEJABAT
        ${where}
      )
      WHERE RN <= :b_limit
      ORDER BY PEJABAT_ID
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const data = rows.map((r) => ({
      pejabat_id: r.PEJABAT_ID,
      nip: toStr(r.NIP),
      nama: toStr(r.NAMA),
      jabatan: toStr(r.JABATAN),
      is_struktural: Number(r.IS_STRUKTURAL ?? 0) === 1,
    }));

    // tetap bentuk { rows, limit } seperti semula
    return ok({ rows: data, limit });
  } catch (e: any) {
    return err(e?.message || "Gagal memuat daftar pejabat");
  }
}
