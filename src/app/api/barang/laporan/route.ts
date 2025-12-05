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

  const barang = Number(body.barang || body.kd_brg || 0) || 0;

  const binds: Record<string, unknown> = {
    start_date: range.start,
    end_date: range.end,
  };

  let filterBarang = "";
  if (barang) {
    filterBarang = "AND KODE_BARANG = :barang";
    binds.barang = barang;
  }

  const SQL = `
    SELECT SEQ_ID, JENIS_BARANG, KODE_BARANG, KET, JUMLAH, SATUAN, JUMLAH || ' ' || SATUAN AS JUMLAH_LABEL, HARGA,
           TO_CHAR(TANGGAL,'DD-MM-YYYY') AS TANGGAL, RECEIVED
    FROM (
      SELECT A.SEQ_ID,
             B.JENIS_BARANG,
             'BARANG MASUK' AS KET,
             A.KODE_BARANG,
             A.JUMLAH,
             B.SATUAN,
             (A.JUMLAH * B.HARGA) AS HARGA,
             A.CREATED_DT AS TANGGAL,
             A.RECEIVED
      FROM SIAK_BARANG_MASUK A
      LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG = B.BARANG_ID
      UNION ALL
      SELECT A.SEQ_ID,
             B.JENIS_BARANG,
             'BARANG KELUAR' AS KET,
             A.KODE_BARANG,
             A.JUMLAH,
             B.SATUAN,
             (A.JUMLAH * B.HARGA) AS HARGA,
             A.CREATED_DT AS TANGGAL,
             A.RECEIVED
      FROM SIAK_BARANG_KELUAR A
      LEFT JOIN SIAK_MASTER_BARANG B ON A.KODE_BARANG = B.BARANG_ID
    )
    WHERE TANGGAL >= TO_DATE(:start_date,'DD-MM-YYYY')
      AND TANGGAL < TO_DATE(:end_date,'DD-MM-YYYY') + 1
      ${filterBarang}
    ORDER BY TANGGAL
  `;

  try {
    const rows = await execRows(SQL, binds, {}, ORACLE_ALIAS);
    await Log.info({
      scope: "API",
      msg: "barang/laporan",
      at: "/api/barang/laporan",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { count: rows.length, ...range, barang },
    });
    return ok(rows);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "barang/laporan/error",
      at: "/api/barang/laporan",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat laporan barang", 500);
  }
}
