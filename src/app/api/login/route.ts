// File: app/api/login/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { execOne, execDml } from "@/lib/db";
import { setSessionCookie } from "@/lib/session"; // ⬅️ pakai util ini

/** Ambil IP asli dari header X-Forwarded-For (bisa "ip1, ip2, ...") */
function getClientIp(req: Request) {
  const xf = req.headers.get("x-forwarded-for") || "";
  const ipFromXf = xf.split(",")[0]?.trim();
  return ipFromXf || "127.0.0.1";
}

/** Tentukan apakah cookie harus 'secure' tanpa mengandalkan NODE_ENV */
function shouldUseSecureCookie(req: Request) {
  const proto = (req.headers.get("x-forwarded-proto") || "").toLowerCase();
  if (proto === "https") return true;             // di belakang proxy HTTPS
  const appEnv = (process.env.APP_ENV || "").toLowerCase(); // kamu sudah punya APP_ENV
  // anggap secure jika bukan lingkungan 'local'
  return appEnv && appEnv !== "local";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const user_id = String(body?.user_id ?? "").trim();
  const pass = String(body?.pass ?? "");
  const ip_address = getClientIp(req);
  const user_agent = req.headers.get("user-agent") || "";

  if (!user_id || !pass) {
    return NextResponse.json(
      { message_type: 0, message: "User ID dan Password wajib diisi" },
      { status: 400 }
    );
  }

  const passwordMd5 = crypto.createHash("md5").update(pass).digest("hex");
  const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  try {
    // 1) Cek user
    const user = await execOne<any>(
      `
      SELECT USER_ID, NAMA_LGKP, NIK, TMPT_LHR,
             TO_CHAR(TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
             JENIS_KLMIN, GOL_DRH, PENDIDIKAN, PEKERJAAN,
             NAMA_KANTOR, ALAMAT_KANTOR, TELP, ALAMAT_RUMAH,
             USER_LEVEL, NO_PROP, NO_KAB, NO_KEC, NO_KEL, NO_RW, NO_RT,
             NAMA_DPN, USER_PWD, IS_ASN, IPADDRESS_CHECK
      FROM SIAK_USER_PLUS
      WHERE USER_ID = :b_user_id
      `,
      { b_user_id: user_id },
      {},
      "DB"
    );

    if (!user) {
      return NextResponse.json({
        message_type: 0,
        message: `Sorry User ${user_id} Not Found, Please Contact Admin For Registration`,
      }, { status: 404 });
    }

    // 2) Validasi masa berlaku aplikasi di DB
    const expRow = await execOne<{ OK?: number }>(
      `
      SELECT CASE
               WHEN TO_DATE(:b_today,'YYYY-MM-DD') <= TO_DATE(SYSTEM_VALUE_TXT,'YYYY-MM-DD')
               THEN 1 ELSE 0
             END AS OK
      FROM SIAK_MASTER
      WHERE SYSTEM_TYPE='INIT_SETING' AND SYSTEM_CODE='EXP'
      `,
      { b_today: todayStr },
      {},
      "DB"
    );
    if (Number(expRow?.OK ?? 0) !== 1) {
      return NextResponse.json({
        message_type: 0,
        message: "Sorry, This Application Expired. Please Contact Administrator",
      }, { status: 403 });
    }

    // 3) Validasi hash legacy akun; tidak ada password universal.
    const dbPass: string = user.USER_PWD || "";
    const passOk = dbPass.toLowerCase() === passwordMd5;
    if (!passOk) {
      return NextResponse.json({
        message_type: 0,
        message: `Password Incorrect For User ${user_id}, Please Try Again`,
      }, { status: 401 });
    }

    // 4) Buat/refresh session
    const session_id = crypto.createHash("sha256")
      .update(user_id + Date.now().toString())
      .digest("hex");

    const updated = await execDml(
      `
      UPDATE SIAK_SESSION_PLUS
         SET SESSION_ID = :b_sid,
             IP_ADDRESS = :b_ip,
             USER_AGENT = :b_ua,
             LAST_ACTIVITY = SYSTIMESTAMP,
             IS_ACTIVE = 1
       WHERE USER_ID = :b_uid
      `,
      { b_sid: session_id, b_ip: ip_address, b_ua: user_agent, b_uid: user_id },
      { autoCommit: true },
      "DB"
    );

    if (updated === 0) {
      await execDml(
        `
        INSERT INTO SIAK_SESSION_PLUS
          (SESSION_ID, IP_ADDRESS, USER_AGENT, LAST_ACTIVITY, USER_ID, IS_ACTIVE)
        VALUES
          (:b_sid, :b_ip, :b_ua, SYSTIMESTAMP, :b_uid, 1)
        `,
        { b_sid: session_id, b_ip: ip_address, b_ua: user_agent, b_uid: user_id },
        { autoCommit: true },
        "DB"
      );
    }

    // 5) Set cookie session
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
      S_NO_PROP: String(user.NO_PROP ?? "").trim(),
      S_NO_KAB: String(user.NO_KAB ?? "").trim(),
      S_NO_KEC: String(user.NO_KEC ?? "").trim(),
      S_NO_KEL: String(user.NO_KEL ?? "").trim(),
      S_NO_RW: String(user.NO_RW ?? "").trim(),
      S_NO_RT: String(user.NO_RT ?? "").trim(),
      S_NAMA_DPN: user.NAMA_DPN,
      S_IS_ASN: user.IS_ASN,
      S_NM_KAB: "Kota Bandung",
    };

    const res = NextResponse.json({
      message_type: 1,
      message: "Success",
      user_name: user.NAMA_LGKP || "User",
    });

    // gunakan maxAge 8 jam (atau dari ENV)
    await setSessionCookie(cookieData, 60 * 60 * 8);

    return res;
  } catch (err: any) {
    console.error("❌ Login Error:", err);
    return NextResponse.json(
      { message_type: 0, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
