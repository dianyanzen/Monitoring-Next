// FILE: src/app/api/report/absensi/daily/route.ts
import { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, badRequest, unauthorized, err } from "@/lib/http";
import { execDml, execOne } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
type CountRow = { JML: number | string };

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const body = await req.json();
    const {
      aktivitas,
      tanggal_report, // "DD/MM/YYYY" dari client
      jumlah,
      daily_dari,
      daily_sampai,
      daily_keterangan,
      get_date,
      check_date,
    } = body ?? {};

    const tanggalStr = String(tanggal_report || "").trim();
    const jumlahStr = String(jumlah || "").trim();
    const jamDari = String(daily_dari ?? "08:00");
    const jamSampai = String(daily_sampai ?? "17:00");
    const keterangan = String(daily_keterangan ?? "");

    const sqlFutureDate = `
      SELECT COUNT(1) AS JML
      FROM DUAL
      WHERE TO_DATE(TO_CHAR(SYSDATE,'DD/MM/YYYY'),'DD/MM/YYYY')
        < TO_DATE(:b_tanggal, 'DD/MM/YYYY')
    `;

    const sqlCheckSameActivity = `
      SELECT COUNT(1) AS JML
      FROM SIAK_DAILY
      WHERE ACTIVITY_ID = :b_activity_id
        AND USER_ID = :b_user_id
        AND TO_CHAR(CREATED_DT, 'DD/MM/YYYY') = :b_tanggal
    `;

    const checkFutureDate = async () => {
      const row = await execOne<CountRow>(
        sqlFutureDate,
        { b_tanggal: tanggalStr },
        {},
        ORACLE_ALIAS
      );
      return Number(row?.JML ?? 0) > 0;
    };

    const checkSameActivity = async (activityId: string) => {
      const row = await execOne<CountRow>(
        sqlCheckSameActivity,
        {
          b_activity_id: activityId,
          b_user_id: String(sess.S_USER_ID),
          b_tanggal: tanggalStr,
        },
        {},
        ORACLE_ALIAS
      );
      return Number(row?.JML ?? 0) > 0;
    };

    // Mode cek tanggal (copy behaviour get_date legacy): jika hanya pengecekan, kembalikan flag boleh input.
    if (get_date || check_date) {
      if (!tanggalStr) return badRequest("Tanggal tidak valid");
      const isFuture = await checkFutureDate();
      return ok(
        isFuture
          ? {
              message_type: 1,
              message: "Anda Tidak Bisa Membuat Daily Report Lebih Dari Hari Ini",
            }
          : { message_type: 2, message: "Tanggal tersedia" }
      );
    }

    if (!aktivitas || !tanggalStr || !jumlahStr || !keterangan) {
      return badRequest("Data daily report belum lengkap");
    }

    const isFuture = await checkFutureDate();
    if (isFuture) {
      return badRequest(
        "Anda Tidak Bisa Membuat Daily Report Lebih Dari Hari Ini",
        { message_type: 1 }
      );
    }

    const existsSameActivity = await checkSameActivity(String(aktivitas));
    if (existsSameActivity) {
      return badRequest(
        "Maaf Anda Tidak Bisa Mengisi Aktivitas Yang Sama Di Hari Yang Sama",
        { message_type: 2 }
      );
    }

    const sql = `
      INSERT INTO SIAK_DAILY (
        DAILY_ID,
        ACTIVITY_ID,
        USER_ID,
        START_ACTIVITY,
        END_ACTIVITY,
        NUMBER_ACTIVITY,
        DESCRIPTION,
        CREATED_BY,
        CREATED_DT,
        IS_VALID
      ) VALUES (
        DAILY_SEQ.NEXTVAL,
        :b_activity_id,
        :b_user_id,
        :b_jam_dari,
        :b_jam_sampai,
        :b_jumlah,
        UPPER(:b_keterangan),
        'SYSTEM',
        TO_DATE(:b_tanggal, 'DD/MM/YYYY'),
        0
      )
    `;

    await execDml(
      sql,
      {
        b_user_id: String(sess.S_USER_ID),
        b_activity_id: String(aktivitas),
        b_tanggal: tanggalStr,
        b_jumlah: jumlahStr,
        b_jam_dari: jamDari,
        b_jam_sampai: jamSampai,
        b_keterangan: keterangan,
      },
      {},
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "ABSENSI_DAILY_SAVE",
      at: "/api/report/absensi/daily",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { tanggal_report, aktivitas },
    });

    return ok({ message: "Daily report tersimpan", message_type: 1 });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "ABSENSI_DAILY_SAVE",
      at: "/api/report/absensi/daily",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menyimpan daily report");
  }
}
