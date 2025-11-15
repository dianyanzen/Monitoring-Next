// FILE: src/app/api/setting/users/[userId]/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, badRequest, err } from "@/lib/http";
import { execOne } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type RawDetailRow = {
  USER_ID: string;
  NAMA_LGKP: string;
  NAMA_DPN: string | null;
  NIK: string;
  TMPT_LHR: string | null;
  TGL_LHR: string | null;
  JENIS_KLMIN: number | string | null;
  GOL_DRH: number | string | null;
  NAMA_KANTOR: string | null;
  ALAMAT_KANTOR: string | null;
  TELP: string | null;
  ALAMAT_RUMAH: string | null;
  USER_LEVEL: number | string;
  LEVEL_NAME: string | null;
  GROUP_NAME: string | null;
  GROUP_CODE: string | null;
  NO_PROP: string | null;
  NAMA_PROP: string | null;
  NO_KAB: string | null;
  NAMA_KAB: string | null;
  NO_KEC: string | null;
  NAMA_KEC: string | null;
  NO_KEL: string | null;
  NAMA_KEL: string | null;
  NO_RW: string | null;
  NO_RT: string | null;
  USER_SIAK: string | null;
  USER_BCARD: string | null;
  USER_BENROL: string | null;
  IS_MONITORING: number | string | null;
  IS_GISA: number | string | null;
  IS_ABSEN: number | string | null;
  IS_ASN: number | string | null;
  ABSENSI_CHECKING: number | string | null;
  IS_ACTIVE: number | string | null;
  IPADDRESS_CHECK: number | string | null;
  IS_SHOW: number | string | null;
  PEJABAT_SATU: number | string | null;
  NAMA_SATU: string | null;
  PEJABAT_DUA: number | string | null;
  NAMA_DUA: string | null;
};

const toBool = (v: unknown) => Number(v ?? 0) === 1;

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const userIdParam = params?.userId?.trim();
    if (!userIdParam) return badRequest("User ID tidak valid");

    const sql = `
      SELECT 
        A.USER_ID,
        A.NAMA_LGKP,
        A.NAMA_DPN,
        A.NIK,
        A.TMPT_LHR,
        TO_CHAR(A.TGL_LHR,'DD-MM-YYYY') TGL_LHR,
        A.JENIS_KLMIN,
        A.GOL_DRH,
        A.NAMA_KANTOR,
        A.ALAMAT_KANTOR,
        A.TELP,
        A.ALAMAT_RUMAH,
        B.USER_LEVEL,
        B.LEVEL_NAME,
        C.LEVEL_NAME AS GROUP_NAME,
        C.LEVEL_CODE AS GROUP_CODE,
        A.NO_PROP,
        UPPER(F5_GET_NAMA_PROVINSI(A.NO_PROP)) AS NAMA_PROP,
        A.NO_KAB,
        UPPER(F5_GET_NAMA_KABUPATEN(A.NO_PROP, A.NO_KAB)) AS NAMA_KAB,
        A.NO_KEC,
        UPPER(F5_GET_NAMA_KECAMATAN(A.NO_PROP, A.NO_KAB, A.NO_KEC)) AS NAMA_KEC,
        A.NO_KEL,
        A.NO_RW,
        A.NO_RT,
        UPPER(F5_GET_NAMA_KELURAHAN(A.NO_PROP, A.NO_KAB, A.NO_KEC, A.NO_KEL)) AS NAMA_KEL,
        A.USER_SIAK,
        A.USER_BCARD,
        A.USER_BENROL,
        A.IS_MONITORING,
        A.IS_GISA,
        A.IS_ABSEN,
        A.IS_ASN,
        A.ABSENSI_CHECKING,
        A.IS_ACTIVE,
        A.IPADDRESS_CHECK,
        A.IS_SHOW,
        NVL(E.PEJABAT_ID, 0) AS PEJABAT_SATU,
        NVL(E.NAMA, '-') AS NAMA_SATU,
        NVL(F.PEJABAT_ID, 0) AS PEJABAT_DUA,
        NVL(F.NAMA, '-') AS NAMA_DUA
      FROM SIAK_USER_PLUS A
      INNER JOIN SIAK_USER_LEVEL B
        ON A.USER_LEVEL = B.USER_LEVEL
      INNER JOIN SIAK_USER_GROUP C
        ON B.GROUP_LEVEL = C.LEVEL_CODE
      LEFT JOIN SIAK_ATASAN D
        ON A.USER_ID = D.USER_ID
      LEFT JOIN SIAK_PEJABAT E
        ON D.ATASAN_SATU = E.PEJABAT_ID
      LEFT JOIN SIAK_PEJABAT F
        ON D.ATASAN_DUA = F.PEJABAT_ID
      WHERE UPPER(A.USER_ID) = UPPER(:b_uid)
    `;

    const row = await execOne<RawDetailRow>(
      sql,
      { b_uid: userIdParam },
      {},
      ORACLE_ALIAS
    );

    if (!row) {
      await Log.info({
        scope: "API",
        msg: "setting/users/detail_not_found",
        at: "/api/setting/users/[userId]",
        user: sess.S_USER_ID,
        tookMs: Date.now() - started,
        extra: { userId: userIdParam },
      });
      return ok(null, "User tidak ditemukan");
    }

    const data = {
      user_id: row.USER_ID?.trim() ?? "",
      nama_lgkp: row.NAMA_LGKP?.trim() ?? "",
      nama_dpn: row.NAMA_DPN?.trim() ?? null,
      nik: row.NIK?.trim() ?? "",
      tmpt_lhr: row.TMPT_LHR?.trim() ?? null,
      tgl_lhr: row.TGL_LHR?.trim() ?? null,
      jenis_klmin: row.JENIS_KLMIN != null ? Number(row.JENIS_KLMIN) : null,
      gol_drh: row.GOL_DRH != null ? Number(row.GOL_DRH) : null,
      nama_kantor: row.NAMA_KANTOR?.trim() ?? null,
      alamat_kantor: row.ALAMAT_KANTOR?.trim() ?? null,
      telp: row.TELP?.trim() ?? null,
      alamat_rumah: row.ALAMAT_RUMAH?.trim() ?? null,
      user_level: row.USER_LEVEL?.toString() ?? "",
      level_name: row.LEVEL_NAME?.trim() ?? "",
      group_name: row.GROUP_NAME?.trim() ?? null,
      wilayah: {
        no_prop: row.NO_PROP?.toString() ?? null,
        no_kab: row.NO_KAB?.toString() ?? null,
        no_kec: row.NO_KEC?.toString() ?? null,
        no_kel: row.NO_KEL?.toString() ?? null,
        no_rw: row.NO_RW?.toString() ?? null,
        no_rt: row.NO_RT?.toString() ?? null,
        nama_prop: row.NAMA_PROP?.trim() ?? null,
        nama_kab: row.NAMA_KAB?.trim() ?? null,
        nama_kec: row.NAMA_KEC?.trim() ?? null,
        nama_kel: row.NAMA_KEL?.trim() ?? null,
      },
      akun: {
        user_siak: row.USER_SIAK?.trim() ?? null,
        user_bcard: row.USER_BCARD?.trim() ?? null,
        user_benrol: row.USER_BENROL?.trim() ?? null,
      },
      flags: {
        is_monitoring: toBool(row.IS_MONITORING),
        is_gisa: toBool(row.IS_GISA),
        is_absen: toBool(row.IS_ABSEN),
        is_asn: toBool(row.IS_ASN),
        absensi_checking: toBool(row.ABSENSI_CHECKING),
        is_active: toBool(row.IS_ACTIVE),
        ipaddress_check: toBool(row.IPADDRESS_CHECK),
        is_show: toBool(row.IS_SHOW),
      },
      supervisors: {
        pejabat_satu:
          row.PEJABAT_SATU != null ? String(row.PEJABAT_SATU) : null,
        pejabat_dua:
          row.PEJABAT_DUA != null ? String(row.PEJABAT_DUA) : null,
        nama_satu: row.NAMA_SATU?.trim() ?? null,
        nama_dua: row.NAMA_DUA?.trim() ?? null,
      },
    };

    await Log.info({
      scope: "API",
      msg: "setting/users/detail_ok",
      at: "/api/setting/users/[userId]",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { userId: userIdParam },
    });

    return ok(data);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/detail_err",
      at: "/api/setting/users/[userId]",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat detail user");
  }
}
