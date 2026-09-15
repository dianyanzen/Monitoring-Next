// FILE: /app/api/dashboard/salaman/route.ts
import { execRows } from "@/lib/db";
import { ok, err } from "@/lib/http";

/**
 * Endpoint: /api/dashboard/salaman
 * Sumber: VW_SIAK_SALAMAN (schema WEBDB)
 * Tujuan: Menyediakan data pelayanan online Salaman untuk dashboard.
 */
export async function GET() {
  try {
    const sql = `
      SELECT 
        ID,
        LAYANAN,
        NVL(BARU_TDY, 0) AS BARU_TDY,
        NVL(UPLOAD_ULANG_TDY, 0) AS UPLOAD_ULANG_TDY,
        NVL(BTL_TDY, 0) AS BTL_TDY,
        NVL(BARU, 0) AS BARU,
        NVL(UPLOAD_ULANG, 0) AS UPLOAD_ULANG,
        NVL(BTL, 0) AS BTL,
        NVL(TERVERIFIKASI, 0) AS TERVERIFIKASI,
        NVL(TERPUBLISH, 0) AS TERPUBLISH
      FROM VW_SIAK_SALAMAN
      ORDER BY ID
    `;

    const rows = await execRows<{
      ID: number;
      LAYANAN: string;
      BARU_TDY: number;
      UPLOAD_ULANG_TDY: number;
      BTL_TDY: number;
      BARU: number;
      UPLOAD_ULANG: number;
      BTL: number;
      TERVERIFIKASI: number;
      TERPUBLISH: number;
    }>(sql, {}, {}, "WEBDB"); // 🔹 gunakan alias "WEBDB" sesuai koneksi schema

    const data = rows.map((r) => ({
      name: r.LAYANAN?.trim() || "Tanpa Nama",
      today: {
        baru: Number(r.BARU_TDY) || 0,
        upload: Number(r.UPLOAD_ULANG_TDY) || 0,
        tidakLengkap: Number(r.BTL_TDY) || 0,
      },
      total: {
        baru: Number(r.BARU) || 0,
        upload: Number(r.UPLOAD_ULANG) || 0,
        tidakLengkap: Number(r.BTL) || 0,
      },
      verif: Number(r.TERVERIFIKASI) || 0,
      publish: Number(r.TERPUBLISH) || 0,
    }));

    return ok(data, 30); // cache 30 detik
  } catch (e) {
    console.error("❌ /api/dashboard/salaman error:", e);
    return err("Gagal mengambil data layanan Salaman");
  }
}
