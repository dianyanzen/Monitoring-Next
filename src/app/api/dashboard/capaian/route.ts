// 📄 src/app/api/dashboard/capaian/route.ts
import { execRows } from "@/lib/db";
import { ok, err } from "@/lib/http";

export async function GET() {
  try {
    const rows = await execRows<{ SYSTEM_CODE: string; SYSTEM_VALUE_NUM: number }>(
      `
      SELECT
        UPPER(SYSTEM_CODE) AS SYSTEM_CODE,
        NVL(SYSTEM_VALUE_NUM, 0) AS SYSTEM_VALUE_NUM
      FROM SIAK_MASTER
      WHERE SYSTEM_TYPE = :b_type
      ORDER BY SYSTEM_CODE DESC
      `,
      { b_type: "SET_DASHBOARD" }
    );

    if (!rows.length) return err("Data tidak ditemukan", 404);

    const map: Record<string, number> = {};
    for (const r of rows) map[r.SYSTEM_CODE] = Number(r.SYSTEM_VALUE_NUM) || 0;

    const fmt = (n: number) => Number(n || 0).toLocaleString("id-ID");
    const pct = (n: number) => `${Number(n || 0).toFixed(2)}%`;

    const data = {
      TARGET_REKAM_R: fmt(map.TARGET_REKAM_R),
      TARGET_REKAM_P: pct(map.TARGET_REKAM_P),
      TARGET_KIA_R: fmt(map.TARGET_KIA_R),
      TARGET_KIA_P: pct(map.TARGET_KIA_P),
      TARGET_AKTE_LHR_R: fmt(map.TARGET_AKTE_LHR_R),
      TARGET_AKTE_LHR_P: pct(map.TARGET_AKTE_LHR_P),
      TARGET_IKD_R: fmt(map.TARGET_IKD_R),
      TARGET_IKD_P: pct(map.TARGET_IKD_P),

      CAPAIAN_REKAM_R: fmt(map.CAPAIAN_REKAM_R),
      CAPAIAN_REKAM_P: pct(map.CAPAIAN_REKAM_P),
      CAPAIAN_KIA_R: fmt(map.CAPAIAN_KIA_R),
      CAPAIAN_KIA_P: pct(map.CAPAIAN_KIA_P),
      CAPAIAN_AKTE_LHR_R: fmt(map.CAPAIAN_AKTE_LHR_R),
      CAPAIAN_AKTE_LHR_P: pct(map.CAPAIAN_AKTE_LHR_P),
      CAPAIAN_IKD_R: fmt(map.CAPAIAN_IKD_R),
      CAPAIAN_IKD_P: pct(map.CAPAIAN_IKD_P),
    };

    return ok(data, 30); // Cache 30 detik
  } catch (e) {
    console.error("❌ /dashboard/capaian error:", e);
    return err("Gagal mengambil data capaian");
  }
}
