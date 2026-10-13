// FILE: src/app/api/check/rekam/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";
import { Log } from "@/lib/log";
import { readServerSession } from "@/lib/session";

const ORACLE_ALIAS = process.env.DB_ALIAS_REKAM ?? process.env.DB_ALIAS_PRR ?? "DB5CETAK";

/** keep only primitive for response safety */
function toPlain(obj: any) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map((x) => toPlain(x));
  if (typeof obj === "object") {
    const p: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) p[k] = v;
      else if (["string", "number", "boolean"].includes(typeof v)) p[k] = v;
    }
    return p;
  }
  return obj;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const s = await readServerSession();
    if (!s?.S_USER_ID) return badRequest("Sesi tidak valid.");

    const body = await req.json().catch(() => ({} as any));

    const no_kec = Number(body?.no_kec ?? 0) || 0;
    const no_kel = Number(body?.no_kel ?? 0) || 0;
    const nik = String(body?.nik ?? "").trim();
    const no_kk = String(body?.no_kk ?? "").trim();
    const user = String(body?.user ?? "").trim();
    const tgl_start = String(body?.tgl_start ?? "").trim(); // "DD-MM-YYYY"
    const tgl_end   = String(body?.tgl_end   ?? "").trim(); // "DD-MM-YYYY"

    // Kalau mau paksa scope kec sesuai sesi, buka baris ini:
    // const forced_no_kec = Number(s?.S_NO_KEC ?? 0) || 0;

    // === Build WHERE dinamis (prioritas: NIK > NO_KK > range tanggal)
    const where: string[] = ["1=1"];
    const binds: Record<string, any> = {};

    if (nik) {
      where.push("A.NIK = :b_nik");
      binds.b_nik = nik;
    } else if (no_kk) {
      where.push("A.NO_KK = :b_no_kk");
      binds.b_no_kk = no_kk;
    } else {
      // Jika tidak ada NIK/NO_KK, gunakan range tanggal (DEFAULT: hari ini kalau kosong)
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const yyyy = today.getFullYear();
      const fallback = `${dd}-${mm}-${yyyy}`;

      const start = tgl_start || fallback;
      const end = tgl_end || start;

      where.push("X.CREATED >= TO_DATE(:b_tgl_start,'DD-MM-YYYY')");
      where.push("X.CREATED <  TO_DATE(:b_tgl_end,'DD-MM-YYYY') + 1");
      binds.b_tgl_start = start;
      binds.b_tgl_end = end;
    }

    if (no_kec) {
      where.push("A.NO_KEC = :b_no_kec");
      binds.b_no_kec = no_kec;
    }
    if (no_kel) {
      where.push("A.NO_KEL = :b_no_kel");
      binds.b_no_kel = no_kel;
    }
    if (user) {
      where.push("X.CREATED_USERNAME = :b_user");
      binds.b_user = user;
    }

    // Jika ingin paksa scope user kecamatan (opsional):
    // if (forced_no_kec) {
    //   where.push("A.NO_KEC = :b_forced_no_kec");
    //   binds.b_forced_no_kec = forced_no_kec;
    // }

    const SQL = `
      SELECT
        TO_CHAR(A.NIK) AS NIK,
        A.NAMA_LGKP,
        A.TMPT_LHR,
        TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
        CASE WHEN A.ALAMAT IS NULL THEN '-' ELSE A.ALAMAT END AS ALAMAT,
        A.NO_KEC, A.NAMA_KEC,
        A.NO_KEL, A.NAMA_KEL,
        CASE WHEN A.NO_RW IS NULL THEN 0 ELSE A.NO_RW END AS NO_RW,
        CASE WHEN A.NO_RT IS NULL THEN 0 ELSE A.NO_RT END AS NO_RT,
        CASE WHEN TO_CHAR(A.KODE_POS) IS NULL THEN '-' ELSE TO_CHAR(A.KODE_POS) END AS KODE_POS,
        A.AGAMA,
        A.STAT_KWN AS STATUS_KAWIN,
        A.JENIS_PKRJN AS PEKERJAAN,
        TO_CHAR(X.CREATED,'YYYY-MM-DD') AS TGL_REKAM,
        TO_CHAR(X.CREATED,'HH24:MI') AS JAM_REKAM,     -- menit = MI (bukan MM)
        A.CURRENT_STATUS_CODE AS STATUS_KTP,
        X.CREATED_USERNAME AS PETUGAS_REKAM
      FROM DEMOGRAPHICS@DB5 A
      INNER JOIN FINGERS@DB5 X ON A.NIK = X.NIK
      WHERE ${where.join(" AND ")}
      ORDER BY X.CREATED
    `;

    const raw = await execRows(SQL, binds, {}, ORACLE_ALIAS);
    const rows = Array.isArray(raw) ? toPlain(raw) : [];

    await Log.info({
      scope: "API",
      msg: "rekam served",
      at: "/api/check/rekam",
      tookMs: Date.now() - t0,
      extra: {
        total: rows.length,
        no_kec,
        no_kel,
        used_nik: !!nik,
        used_no_kk: !!no_kk,
        used_range: !nik && !no_kk,
        user_filter: !!user,
      },
    });

    return ok({ rows, total: rows.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "rekam error",
      at: "/api/check/rekam",
      tookMs: Date.now() - t0,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat data", 500);
  }
}
