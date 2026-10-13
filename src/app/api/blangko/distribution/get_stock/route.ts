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
    const noKec = Number(body.no_kec ?? body.noKec ?? 0);
    // Izinkan 0 (DINAS) seperti legacy; hanya tolak nilai negatif / non-numerik
    if (!Number.isFinite(noKec) || noKec < 0) return badRequest("Kecamatan wajib dipilih.");

    const sql = `
      SELECT
        NO_WIL,
        NAMA_WIL,
        JENIS_BARANG,
        NAMA_BARANG,
        NVL(JUMLAH, 0) AS JUMLAH,
        TO_CHAR(TANGGAL,'DD-MM-YYYY') AS TANGGAL
      FROM SIAK_MONEV_WILAYAH_STOK
      WHERE NO_WIL = :no_kec
      ORDER BY JENIS_BARANG
    `;

    let items = await execRows(sql, { no_kec: noKec }, {}, ORACLE_ALIAS);

    // Fallback: jika stok belum ada, hitung dari transaksi IN/OUT
    if (!items.length) {
      const fallbackSql = `
        SELECT
          :no_kec AS NO_WIL,
          COALESCE((SELECT NAMA_WIL FROM SIAK_KODE_WIL WHERE NO_WIL = :no_kec),'DINAS') AS NAMA_WIL,
          A.JNS AS JENIS_BARANG,
          COALESCE(M.DESCRIP, 'BARANG ' || A.JNS) AS NAMA_BARANG,
          NVL(SUM(CASE WHEN W.KATEGORI = 'IN' THEN W.JUMLAH WHEN W.KATEGORI = 'OUT' THEN -W.JUMLAH ELSE 0 END),0) AS JUMLAH,
          TO_CHAR(MAX(W.TANGGAL),'DD-MM-YYYY') AS TANGGAL
        FROM (
          SELECT NO AS JNS FROM SIAK_MASTER_ASET WHERE SECT = 6
          UNION
          SELECT DISTINCT JENIS_BARANG AS JNS FROM SIAK_MONEV_WILAYAH WHERE NO_KEC = :no_kec
        ) A
        LEFT JOIN SIAK_MONEV_WILAYAH W ON W.NO_KEC = :no_kec AND W.JENIS_BARANG = A.JNS
        LEFT JOIN SIAK_MASTER_ASET M ON M.SECT = 6 AND M.NO = A.JNS
        GROUP BY A.JNS, M.DESCRIP
        ORDER BY A.JNS
      `;
      items = await execRows(fallbackSql, { no_kec: noKec }, {}, ORACLE_ALIAS);
    }

    await Log.info({
      scope: "API",
      msg: "blangko/distribution/get_stock",
      at: "/api/blangko/distribution/get_stock",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { noKec, total: items.length },
    });

    const title = items?.[0]?.NAMA_WIL ?? items?.[0]?.nama_wil ?? null;
    return ok({ items, title });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "blangko/distribution/get_stock_err",
      at: "/api/blangko/distribution/get_stock",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memuat stok wilayah", 500);
  }
}
