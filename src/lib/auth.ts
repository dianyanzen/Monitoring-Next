import oracledb from "oracledb";
import crypto from "crypto";
import { getOracleConnection } from "@/lib/oracle";

export function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

export type AuthRow = {
  USER_ID: string;
  USER_PWD: string;
  NAMA_LGKP?: string;
  NIK?: string;
  TMPT_LHR?: string;
  TGL_LHR?: string;     // DD-MM-YYYY
  JENIS_KLMIN?: string;
  TELP?: string;
  USER_SIAK?: string;
  USER_BCARD?: string;
  USER_BENROL?: string;
};

export async function lgn_check_user(user_id: string): Promise<AuthRow | null> {
  const conn = await getOracleConnection();
  try {
    const sql = `
      SELECT USER_ID, USER_PWD, NAMA_LGKP, NIK, TMPT_LHR,
             TO_CHAR(TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
             JENIS_KLMIN, TELP, USER_SIAK, USER_BCARD, USER_BENROL
      FROM SIAK_USER_PLUS
      WHERE USER_ID = :user_id
    `;
    const res = await conn.execute(sql, { user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return (res.rows?.[0] as AuthRow) || null;
  } finally {
    try { await conn.close(); } catch {}
  }
}

export async function lgn_change_pwd(user_id: string, new_pwd_md5: string): Promise<number> {
  const conn = await getOracleConnection();
  try {
    const sql = `UPDATE SIAK_USER_PLUS SET USER_PWD = :pwd WHERE USER_ID = :user_id`;
    const r = await conn.execute(sql, { pwd: new_pwd_md5, user_id }, { autoCommit: true });
    return r.rowsAffected || 0;
  } finally {
    try { await conn.close(); } catch {}
  }
}
