// FILE: src/app/api/setting/pejabat/route.ts
import type { NextRequest } from "next/server";
import { readServerSession, getClientInfo } from "@/lib/session";
import { ok, unauthorized, err, badRequest } from "@/lib/http";
import { execRows, execOne, execDml } from "@/lib/db";
import { Log } from "@/lib/log";

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
const normalizeNip = (value: unknown) => String(value ?? "").replace(/[^\d]/g, "");
const normalizeUpper = (value: unknown) => String(value ?? "").trim().toUpperCase();
const normalizeStruktural = (value: unknown) => {
  if (value === true || String(value).trim() === "1") return 1;
  return 0;
};

export async function GET(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
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

    await Log.info({
      scope: "API",
      msg: "pejabat/list",
      at: "/api/setting/pejabat",
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { count: data.length, limit },
    });

    return ok({ rows: data, limit });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "pejabat/list_err",
      at: "/api/setting/pejabat",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal memuat daftar pejabat");
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const nip = normalizeNip(body.nip);
    const nama = normalizeUpper(body.nama);
    const jabatan = normalizeUpper(body.jabatan);
    const isStruktural = normalizeStruktural(body.is_struktural ?? body.struktural);

    if (!nip) return badRequest("NIP pejabat wajib diisi", { field: "nip" });
    if (nip.length < 8 || nip.length > 30) {
      return badRequest("Format NIP tidak valid", { field: "nip" });
    }
    if (!nama) return badRequest("Nama pejabat wajib diisi", { field: "nama" });
    if (!jabatan) return badRequest("Jabatan pejabat wajib diisi", { field: "jabatan" });

    const nextRow = await execOne<{ NEXT_ID?: number }>(
      `SELECT NVL(MAX(PEJABAT_ID), 0) + 1 AS NEXT_ID FROM SIAK_PEJABAT`,
      {},
      {},
      ORACLE_ALIAS
    );
    const pejabatId = Number(nextRow?.NEXT_ID ?? 1);

    await execDml(
      `
      INSERT INTO SIAK_PEJABAT (PEJABAT_ID, NIP, NAMA, JABATAN, IS_STRUKTURAL)
      VALUES (:b_id, :b_nip, :b_nama, :b_jabatan, :b_struktural)
      `,
      {
        b_id: pejabatId,
        b_nip: nip,
        b_nama: nama,
        b_jabatan: jabatan,
        b_struktural: isStruktural,
      },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "pejabat/create",
      at: "/api/setting/pejabat",
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { pejabatId, nip },
    });

    return ok({ pejabat_id: pejabatId }, "Pejabat berhasil ditambahkan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "pejabat/create_err",
      at: "/api/setting/pejabat",
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyimpan pejabat baru");
  }
}
