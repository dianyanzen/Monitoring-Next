// 📄 src/app/api/dashboard/dkb/summary/route.ts
import { execRows } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const rows = await execRows<{
      DKB: string;
      R1: number;
      R2: number;
      JUMLAH: number;
    }>(
      `
      SELECT DKB, SUM(R1) AS R1, SUM(R2) AS R2, SUM(JUMLAH) AS JUMLAH
      FROM SIAK_STT_JK
      GROUP BY DKB
      ORDER BY DKB DESC
      `
    );

    return ok({ rows }, 30); // cache 30 detik
  } catch (e) {
    console.error("❌ /dashboard/dkb/summary error:", e);
    return err("Gagal mengambil ringkasan DKB");
  }
}
