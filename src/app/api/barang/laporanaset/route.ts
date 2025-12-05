import type { NextRequest } from "next/server";
import { badRequest, err, ok } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_BARANG ?? process.env.DB_ALIAS_PRR ?? "DB222";

type RangeInput = {
  start: string;
  end: string;
};

function normalizeRange(body: Record<string, any>): RangeInput | null {
  const range = (body.tanggal || body.range || "") as string;
  let start = (body.start || "").toString().trim();
  let end = (body.end || "").toString().trim();

  if (!start && !end && range.includes("-")) {
    const parts = range.split("-").map((p) => p.trim());
    if (parts.length >= 2) {
      start = parts[0];
      end = parts[1];
    }
  }

  const re = /^\d{2}-\d{2}-\d{4}$/;
  if (!re.test(start) || !re.test(end)) return null;
  return { start, end };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const session = await readServerSession();
  if (!session?.S_USER_ID) return badRequest("Sesi tidak valid.");

  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  const range = normalizeRange(body);
  if (!range) return badRequest("Rentang tanggal wajib diisi (DD-MM-YYYY).");

  const jenis = Number(body.jenis || body.jenis_barang || body.barang || 0) || 0;
  const kategoriRaw = (body.kategori || body.category || "").toString().trim().toUpperCase();
  const kategori = kategoriRaw === "IN" || kategoriRaw === "OUT" ? kategoriRaw : "";

  const binds: Record<string, unknown> = {
    start_date: range.start,
    end_date: range.end,
  };

  let filterJenis = "";
  if (jenis) {
    filterJenis = "AND JENIS_BARANG = :jenis";
    binds.jenis = jenis;
  }

  let filterKategori = "";
  if (kategori) {
    filterKategori = "AND KATEGORI = :kategori";
    binds.kategori = kategori;
  }

  const SQL = `
    SELECT 
      NO_KEC,
      F5_GET_REF_WILAYAH(NO_KEC) AS NAMA_WIL,
      JENIS_BARANG,
      F5_GET_REF_SIAK_ASET(JENIS_BARANG,6) AS NAMA_BARANG,
      JUMLAH,
      TO_CHAR(TANGGAL,'DD-MM-YYYY') AS TANGGAL,
      PENERIMA,
      CASE WHEN KATEGORI = 'IN' THEN 'PENERIMAAN (IN)' ELSE 'PENGELUARAN (OUT)' END AS KATEGORI
    FROM SIAK_MONEV_WILAYAH
    WHERE TANGGAL >= TO_DATE(:start_date,'DD-MM-YYYY')
      AND TANGGAL < TO_DATE(:end_date,'DD-MM-YYYY') + 1
      ${filterJenis}
      ${filterKategori}
    ORDER BY TANGGAL DESC, NO_KEC, JENIS_BARANG
  `;

  try {
    const rows = await execRows(SQL, binds, {}, ORACLE_ALIAS);
    await Log.info({
      scope: "API",
      msg: "barang/laporanaset",
      at: "/api/barang/laporanaset",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { count: rows.length, ...range, jenis, kategori: kategori || "ALL" },
    });
    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/laporanaset/error",
      at: "/api/barang/laporanaset",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat laporan aset", 500);
  }
}
