// 📄 src/app/api/dashboard/dkb/ref/route.ts
import { execOneText } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const val = await execOneText(
      `
      SELECT NVL(SYSTEM_VALUE_TXT, '') AS VAL
      FROM SIAK_MASTER
      WHERE SYSTEM_TYPE = :b_type
        AND SYSTEM_CODE = :b_code
      FETCH FIRST 1 ROW ONLY
      `,
      { b_type: "INIT_SETING", b_code: "DKB" }
    );

    return ok({ dkb: val }, 30); // Cache 30 detik
  } catch (e) {
    console.error("❌ /dashboard/dkb/ref error:", e);
    return err("Gagal mengambil referensi DKB");
  }
}
