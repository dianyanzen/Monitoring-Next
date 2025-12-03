// FILE: src/app/api/report/absensi/clock/route.ts
import { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { execDml, execOne } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";

type AccessRow = { USER_ID: string; NAMA_LGKP: string };
type AbsensiRow = { SEQ_ID?: string; JAM_MASUK?: string; JAM_KELUAR?: string };
type CountRow = { JML?: number | string };

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const IPV4_REGEX = /(\d{1,3}\.){3}\d{1,3}/;

function normalizeIp(raw: string) {
  if (!raw) return "-";
  if (raw === "::1") return "127.0.0.1";
  if (raw.startsWith("::ffff:")) return raw.slice(7);
  return raw;
}

function pickFirstIpv4(input: string) {
  const m = input.match(IPV4_REGEX);
  return m ? m[0] : "";
}

function clientIp(req: NextRequest) {
  const candidates = [
    req.headers.get("x-forwarded-for") ?? "",
    req.headers.get("x-real-ip") ?? "",
    req.headers.get("x-client-ip") ?? "",
    req.headers.get("x-forwarded") ?? "",
    req.headers.get("forwarded") ?? "",
    req.headers.get("remote-addr") ?? "",
    req.headers.get("cf-connecting-ip") ?? "",
    req.headers.get("true-client-ip") ?? "",
  ];

  for (const c of candidates) {
    const ipv4 = pickFirstIpv4(c);
    if (ipv4) return ipv4;
  }

  // @ts-ignore -- NextRequest.ip tidak selalu tersedia
  const raw = normalizeIp((req as any).ip || "");
  const ipv4 = pickFirstIpv4(raw);
  return ipv4 || raw;
}

function ipSegment(ip: string) {
  const m = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\./);
  return m ? m[1] : "";
}

function ketClock(jamMasuk: string) {
  return jamMasuk <= "07:30" ? "Tepat Waktu" : "Terlambat";
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { mode, ip_override } = (await req.json().catch(() => ({}))) as {
      mode?: "in" | "out";
      ip_override?: string;
    };

    if (mode !== "in" && mode !== "out") {
      return badRequest("Parameter mode tidak valid");
    }

    const userId = String(sess.S_USER_ID);
    const overrideIp = normalizeIp(String(ip_override || "").trim());
    const detectedIp = normalizeIp(clientIp(req));
    const ipAddr = overrideIp !== "-" ? overrideIp : detectedIp;
    const ipSeg = ipSegment(ipAddr);

    const accessRow = await execOne<AccessRow>(
      `
        SELECT USER_ID, NAMA_LGKP
        FROM SIAK_USER_PLUS
        WHERE USER_ID = :b_user_id
          AND IS_ABSEN = 1
          AND IS_ABSEN_MACHINE = 0
      `,
      { b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    if (!accessRow?.USER_ID) {
      return badRequest("Anda Tidak Memiliki Hak Akses Untuk Absen", {
        is_save: 1,
      });
    }

    if (ipSeg) {
      const ipAllowedRow = await execOne<CountRow>(
        `
          SELECT COUNT(1) AS JML
          FROM SIAK_IPADDRESS
          WHERE USER_ID = :b_user_id
            AND regexp_substr(ip_address, '\\d+',1,1) || '.' || regexp_substr(ip_address, '\\d+',1,2) || '.' || regexp_substr(ip_address, '\\d+',1,3) = :b_ip_segment
        `,
        { b_user_id: userId, b_ip_segment: ipSeg },
        {},
        ORACLE_ALIAS
      );

      const ipAllowed = Number(ipAllowedRow?.JML ?? 0) > 0;
      if (!ipAllowed) {
        return badRequest(
          `Anda Tidak Dapat Absen Di IP : ${ipAddr}, Harap Absen Dengan IP Yang Benar !`,
          { is_save: 1 }
        );
      }
    }

    const todayRow = await execOne<AbsensiRow>(
      `
        SELECT SEQ_ID, JAM_MASUK, JAM_KELUAR
        FROM SIAK_ABSENSI
        WHERE USER_ID = :b_user_id
          AND TRUNC(TANGGAL) = TRUNC(SYSDATE)
      `,
      { b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    const jamNow = nowHHMM();
    const tanggalNow = todayDDMMYYYY();

    if (mode === "in") {
      if (todayRow?.SEQ_ID) {
        return badRequest("Anda Sudah Clock In", { is_save: 1 });
      }

      await execDml(
        `
          INSERT INTO SIAK_ABSENSI (
            SEQ_ID,
            USER_ID,
            NAMA,
            TANGGAL,
            JAM_MASUK,
            JAM_KELUAR,
            KETERANGAN,
            CI_FROM,
            IP_ADDRESS
          ) VALUES (
            :b_seq_id,
            :b_user_id,
            :b_nama,
            TO_DATE(:b_tanggal,'DD/MM/YYYY'),
            :b_jam_masuk,
            :b_jam_keluar,
            :b_ket,
            'MONITORING',
            :b_ip
          )
        `,
        {
          b_seq_id: `${tanggalNow.replace(/\//g, "")}-${userId}-${Date.now()}`,
          b_user_id: userId,
          b_nama: accessRow.NAMA_LGKP,
          b_tanggal: tanggalNow,
          b_jam_masuk: jamNow,
          b_jam_keluar: jamNow,
          b_ket: ketClock(jamNow),
          b_ip: ipAddr,
        },
        {},
        ORACLE_ALIAS
      );

      await Log.info({
        scope: "API",
        msg: "ABSENSI_CLOCK_IN",
        at: "/api/report/absensi/clock",
        user: userId,
        tookMs: Date.now() - started,
        extra: { jam: jamNow, ip: ipAddr },
      });

      return ok({
        success: true,
        status: "in",
        clock_in: jamNow,
        clock_out: jamNow,
        message: `${userId} Telah Berhasil Clock In.`,
        ip: ipAddr,
      });
    }

    // mode === "out"
    if (!todayRow?.SEQ_ID) {
      return badRequest("Anda Harus Clock In Terlebih Dahulu", {
        is_save: 1,
      });
    }

    await execDml(
      `
        UPDATE SIAK_ABSENSI
        SET JAM_KELUAR = :b_jam_keluar
        WHERE USER_ID = :b_user_id
          AND TRUNC(TANGGAL) = TRUNC(SYSDATE)
      `,
      { b_jam_keluar: jamNow, b_user_id: userId },
      {},
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "ABSENSI_CLOCK_OUT",
      at: "/api/report/absensi/clock",
      user: userId,
      tookMs: Date.now() - started,
      extra: { jam: jamNow, ip: ipAddr },
    });

    return ok({
      success: true,
      status: "out",
      clock_in: todayRow.JAM_MASUK ?? "-",
      clock_out: jamNow,
      message: `${userId} Jam Keluar Telah Di Update, Selamat Beristirahat.`,
      ip: ipAddr,
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "ABSENSI_CLOCK",
      at: "/api/report/absensi/clock",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memproses clock in/out");
  }
}
