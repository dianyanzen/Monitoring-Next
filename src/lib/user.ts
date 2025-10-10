// src/lib/user.ts
import oracledb from "oracledb";
import { getOracleConnection } from "@/lib/oracle";

// Utility: sembunyikan '-' sebagai null
const normalize = (v: any) => (v === "-" ? null : v);

export type UserProfile = {
  user_id: string | null;
  user_pwd?: string | null; // kalau memang diperlukan (hindari kirim ke client)
  nama_lgkp: string | null;
  nik: string | null;
  tmpt_lhr: string | null;
  tgl_lhr: string | null;   // sudah di-format DD-MM-YYYY
  jenis_klmin: string | null;
  telp: string | null;
  user_siak: string | null;
  user_bcard: string | null;
  user_benrol: string | null;
};

export async function getUserById(user_id: string): Promise<UserProfile | null> {
  const conn = await getOracleConnection();
  try {
    const sql = `
      SELECT
        USER_ID,
        USER_PWD,
        NAMA_LGKP,
        NIK,
        TMPT_LHR,
        TGL_LHR,
        JENIS_KLMIN,
        TELP,
        USER_SIAK,
        USER_BCARD,
        USER_BENROL
      FROM VW_SIAK_USER
      WHERE USER_ID = :user_id
    `;
    const res = await conn.execute(sql, { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const row = (res.rows?.[0] as any) || null;
    if (!row) return null;
    return {
      user_id: normalize(row.USER_ID),
      user_pwd: normalize(row.USER_PWD),
      nama_lgkp: normalize(row.NAMA_LGKP),
      nik: normalize(row.NIK),
      tmpt_lhr: normalize(row.TMPT_LHR),
      tgl_lhr: normalize(row.TGL_LHR),
      jenis_klmin: normalize(row.JENIS_KLMIN),
      telp: normalize(row.TELP),
      user_siak: normalize(row.USER_SIAK),
      user_bcard: normalize(row.USER_BCARD),
      user_benrol: normalize(row.USER_BENROL),
    };
  } finally {
    try { await conn.close(); } catch {}
  }
}
