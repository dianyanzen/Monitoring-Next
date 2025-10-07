import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();

    const sql = `
      SELECT UPPER(SYSTEM_CODE) AS SYSTEM_CODE, NVL(SYSTEM_VALUE_NUM,0) AS SYSTEM_VALUE_NUM
      FROM SIAK_MASTER
      WHERE SYSTEM_TYPE = 'SET_DASHBOARD'
      ORDER BY SYSTEM_CODE DESC
    `;
    const rows = (await conn.execute(sql)).rows as Array<{ SYSTEM_CODE: string; SYSTEM_VALUE_NUM: number }>;

    if (!rows?.length) {
      return NextResponse.json({ success: false, message: "Data tidak ditemukan" });
    }

    const map: Record<string, number> = {};
    for (const r of rows) map[r.SYSTEM_CODE] = Number(r.SYSTEM_VALUE_NUM) || 0;

    const fmt = (n: number) => Number(n || 0).toLocaleString("id-ID");
    const pct = (n: number) => `${(Number(n || 0)).toFixed(2)}%`;

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

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("❌ /capaian error:", err);
    return NextResponse.json({ success: false, message: "DB error capaian" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
