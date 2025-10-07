import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

export async function GET() {
  let conn;
  try {
    conn = await getOracleConnection();

    const sql = `
      WITH 
      CUTOFF AS (
        SELECT TO_DATE(SYSTEM_VALUE_TXT,'DD/MM/YYYY') AS TGL_CUTOFF
        FROM SIAK_MASTER
        WHERE SYSTEM_CODE = 'DKB_CUTOFF'
      ),
      DKB_REF AS (
        SELECT SYSTEM_VALUE_TXT AS DKB_VAL
        FROM SIAK_MASTER
        WHERE SYSTEM_CODE = 'DKB_REF'
      ),
      JUMLAH_PENDUDUK AS (
        SELECT SUM(JUMLAH) AS JML FROM SIAK_STT_JK 
        WHERE DKB IN (SELECT DKB_VAL FROM DKB_REF)
      ),
      AKTA_LAHIR AS (
        SELECT COUNT(*) AS JML FROM SIAK_BNBA_AKTA_LAHIR, CUTOFF
        WHERE ADM_AKTA_TGL >= CUTOFF.TGL_CUTOFF
      ),
      AKTA_MATI AS (
        SELECT COUNT(*) AS JML FROM SIAK_BNBA_AKTA_MATI, CUTOFF
        WHERE ADM_AKTA_TGL >= CUTOFF.TGL_CUTOFF
      ),
      PERPINDAHAN AS (
        SELECT COUNT(*) AS JML FROM SIAK_BNBA_PINDAH, CUTOFF
        WHERE TGL_PINDAH >= CUTOFF.TGL_CUTOFF
          AND KLASIFIKASI_PINDAH IN ('(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
      ),
      KEDATANGAN AS (
        SELECT COUNT(*) AS JML FROM SIAK_BNBA_DATANG, CUTOFF
        WHERE TGL_DATANG >= CUTOFF.TGL_CUTOFF
          AND KLASIFIKASI_PINDAH IN ('(4) ANTAR KAB/KOTA','(5) ANTAR PROVINSI')
      )
      SELECT 'JUMLAH_PENDUDUK' AS KET, (SELECT JML FROM JUMLAH_PENDUDUK) AS JML FROM DUAL
      UNION ALL
      SELECT 'AKTA_KELAHIRAN', (SELECT JML FROM AKTA_LAHIR) FROM DUAL
      UNION ALL
      SELECT 'AKTA_KEMATIAN', (SELECT JML FROM AKTA_MATI) FROM DUAL
      UNION ALL
      SELECT 'PERPINDAHAN', (SELECT JML FROM PERPINDAHAN) FROM DUAL
      UNION ALL
      SELECT 'KEDATANGAN', (SELECT JML FROM KEDATANGAN) FROM DUAL
      UNION ALL
      SELECT 'PENDUDUK_EFEKTIF', (
        (SELECT JML FROM JUMLAH_PENDUDUK)
        + (SELECT JML FROM AKTA_LAHIR)
        + (SELECT JML FROM KEDATANGAN)
        - (SELECT JML FROM PERPINDAHAN)
        - (SELECT JML FROM AKTA_MATI)
      ) FROM DUAL
    `;

    const rs = await conn.execute(sql);
    const rows = (rs.rows as Array<{ KET: string; JML: number }>) || [];
    const map: Record<string, number> = {};
    for (const r of rows) map[r.KET] = Number(r.JML) || 0;

    return NextResponse.json({
      success: true,
      data: {
        JUMLAH_PENDUDUK: map.JUMLAH_PENDUDUK ?? 0,
        AKTA_KELAHIRAN: map.AKTA_KELAHIRAN ?? 0,
        AKTA_KEMATIAN: map.AKTA_KEMATIAN ?? 0,
        PERPINDAHAN: map.PERPINDAHAN ?? 0,
        KEDATANGAN: map.KEDATANGAN ?? 0,
        PENDUDUK_EFEKTIF: map.PENDUDUK_EFEKTIF ?? 0,
      },
    });
  } catch (err) {
    console.error("❌ /population error:", err);
    return NextResponse.json({ success: false, message: "DB error population" }, { status: 500 });
  } finally {
    if (conn) await conn.close();
  }
}
