import { NextResponse } from "next/server";
import { withConnection } from "@/lib/oracle";

/**
 * Endpoint: /api/dashboard/salaman
 * Sumber data: VW_SIAK_SALAMAN (schema WEBDB)
 * Tujuan: Menyediakan data layanan Salaman untuk Dashboard Pelayanan Online
 */

export async function GET() {
  try {
    // Gunakan connection pool yang sudah dibuat via withConnection()
    const rows = await withConnection("WEBDB", async (conn) => {
      const rs = await conn.execute<{
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
      }>(`
        SELECT 
          ID,
          LAYANAN,
          COALESCE(BARU_TDY, 0) AS BARU_TDY,
          COALESCE(UPLOAD_ULANG_TDY, 0) AS UPLOAD_ULANG_TDY,
          COALESCE(BTL_TDY, 0) AS BTL_TDY,
          COALESCE(BARU, 0) AS BARU,
          COALESCE(UPLOAD_ULANG, 0) AS UPLOAD_ULANG,
          COALESCE(BTL, 0) AS BTL,
          COALESCE(TERVERIFIKASI, 0) AS TERVERIFIKASI,
          COALESCE(TERPUBLISH, 0) AS TERPUBLISH
        FROM VW_SIAK_SALAMAN
        ORDER BY ID
      `);
      return rs.rows ?? [];
    });

    // 🔹 Transform ke format siap frontend
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

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error("❌ /api/dashboard/salaman error:", err);
    return NextResponse.json(
      { success: false, message: "Gagal mengambil data layanan Salaman", data: [] },
      { status: 500 }
    );
  }
}
