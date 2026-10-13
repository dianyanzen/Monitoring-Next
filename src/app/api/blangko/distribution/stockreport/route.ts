import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
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
    const tglStart = String(body.tgl_start ?? body.tanggal_start ?? body.tglStart ?? body.tanggal ?? "").trim();
    const tglEnd = String(body.tgl_end ?? body.tanggal_end ?? body.tglEnd ?? "").trim() || tglStart;
    const noWil = Number(body.no_wil ?? body.no_kec ?? body.noKec ?? 0) || 0;
    const jenisBarang = Number(body.jns_barang ?? body.jenis_barang ?? 0) || 0;
    const kategori = String(body.kategori ?? "").trim().toUpperCase(); // IN/OUT/- (all)

    if (!/^\d{2}-\d{2}-\d{4}$/.test(tglStart)) return badRequest("Tanggal awal tidak valid (DD-MM-YYYY).");
    if (!/^\d{2}-\d{2}-\d{4}$/.test(tglEnd)) return badRequest("Tanggal akhir tidak valid (DD-MM-YYYY).");

    const where: string[] = [
      "TO_CHAR(TANGGAL,'DD-MM-YYYY') >= :t1",
      "TO_CHAR(TANGGAL,'DD-MM-YYYY') <= :t2",
    ];
    const binds: Record<string, any> = { t1: tglStart, t2: tglEnd };

    if (noWil) {
      where.push("NO_KEC = :no_wil");
      binds.no_wil = noWil;
    }
    if (jenisBarang) {
      where.push("JENIS_BARANG = :jns_barang");
      binds.jns_barang = jenisBarang;
    }
    if (kategori && kategori !== "-") {
      where.push("KATEGORI = :kat");
      binds.kat = kategori;
    }

    const sql = `
      SELECT
        NO_KEC,
        F5_GET_REF_WILAYAH(NO_KEC) AS NAMA_WIL,
        JENIS_BARANG,
        F5_GET_REF_SIAK_ASET(JENIS_BARANG,6) AS NAMA_BARANG,
        JUMLAH,
        TO_CHAR(TANGGAL,'DD-MM-YYYY') AS TANGGAL,
        NVL(PENERIMA,'-') AS PENERIMA,
        CASE WHEN KATEGORI = 'IN' THEN 'PENERIMAAN (IN)' ELSE 'PENGELUARAN (OUT)' END AS KATEGORI
      FROM SIAK_MONEV_WILAYAH
      WHERE ${where.join(" AND ")}
      ORDER BY TANGGAL DESC, NO_KEC, JENIS_BARANG
    `;

    const items = await execRows(sql, binds, {}, ORACLE_ALIAS);

    await Log.info({
      scope: "API",
      msg: "blangko/distribution/stockreport",
      at: "/api/blangko/distribution/stockreport",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { total: items.length, tglStart, tglEnd, noWil, jenisBarang, kategori },
    });

    return ok({ items, count: items.length });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/distribution/stockreport_err",
      at: "/api/blangko/distribution/stockreport",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat laporan distribusi", 500);
  }
}
