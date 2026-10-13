// FILE: src/app/api/setting/users/[userId]/route.ts
import type { NextRequest } from "next/server";
import { readServerSession } from "@/lib/session";
import { ok, unauthorized, badRequest, err } from "@/lib/http";
import { execOne, withTransaction } from "@/lib/db";
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
// sekarang numerik bener2 ikut nilai yang dikirim: 0/1/string/boolean
const toNumFlag = (v: unknown) => Number(v ?? 0);

type UpdatePayload = {
  nama_lgkp: string;
  nama_dpn?: string | null;
  nik: string;
  tmpt_lhr: string;
  tgl_lhr: string; // DD-MM-YYYY
  jenis_klmin: number | string;
  gol_drh: number | string;
  nama_kantor: string;
  alamat_kantor: string;
  telp: string;
  alamat_rumah: string;
  user_level: string | number;
  wilayah: {
    no_prop: string | number;
    no_kab: string | number;
    no_kec: string | number;
    no_kel: string | number;
    no_rw?: string | number | null;
    no_rt?: string | number | null;
  };
  akun?: {
    user_siak?: string | null;
    user_bcard?: string | null;
    user_benrol?: string | null;
  };
  flags?: {
    is_monitoring?: boolean | number | string;
    is_gisa?: boolean | number | string;
    is_absen?: boolean | number | string;
    is_asn?: boolean | number | string;
    absensi_checking?: boolean | number | string;
    is_active?: boolean | number | string;
    ipaddress_check?: boolean | number | string;
    is_show?: boolean | number | string;
  };
  supervisors?: {
    pejabat_satu?: string | number | null;
    pejabat_dua?: string | number | null;
  };
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { userId } = await params;
    const userIdParam = userId?.trim();
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
    return err("Gagal memuat detail user");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { userId } = await params;
    const userIdParam = userId?.trim();
    if (!userIdParam) return badRequest("User ID tidak valid");

    const body = (await req.json().catch(() => null)) as UpdatePayload | null;
    if (!body) return badRequest("Payload tidak valid");

    let {
      nama_lgkp,
      nama_dpn,
      nik,
      tmpt_lhr,
      tgl_lhr,
      jenis_klmin,
      gol_drh,
      nama_kantor,
      alamat_kantor,
      telp,
      alamat_rumah,
      user_level,
      wilayah,
      akun,
      flags,
      supervisors,
    } = body;

    // mirror legacy: hard validation
    if (!nama_lgkp || typeof nama_lgkp !== "string") return badRequest("Nama lengkap wajib diisi");
    if (!nik || typeof nik !== "string" || !/^\d{16}$/.test(nik)) return badRequest("NIK harus 16 digit");
    if (!tmpt_lhr || typeof tmpt_lhr !== "string") return badRequest("Tempat lahir wajib diisi");
    if (!tgl_lhr || typeof tgl_lhr !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(tgl_lhr)) {
      return badRequest("Tanggal lahir wajib dan gunakan format DD-MM-YYYY");
    }
    if (!nama_kantor || typeof nama_kantor !== "string") return badRequest("Nama kantor wajib diisi");
    if (!alamat_kantor || typeof alamat_kantor !== "string") return badRequest("Alamat kantor wajib diisi");
    if (!telp || typeof telp !== "string") return badRequest("Telepon wajib diisi");
    if (!alamat_rumah || typeof alamat_rumah !== "string") return badRequest("Alamat rumah wajib diisi");
    if (!user_level) return badRequest("Level user wajib diisi");
    if (!wilayah || typeof wilayah !== "object") return badRequest("Wilayah wajib diisi");

    const {
      no_prop,
      no_kab,
      no_kec,
      no_kel,
      no_rw,
      no_rt,
    } = wilayah;

    if (!no_prop) return badRequest("Provinsi wajib diisi");
    if (!no_kab) return badRequest("Kab/Kota wajib diisi");
    if (!no_kec) return badRequest("Kecamatan wajib diisi");
    if (!no_kel) return badRequest("Kelurahan wajib diisi");

    // uppercase seperti Laravel lama (walaupun UI sudah uppercase)
    nama_lgkp = nama_lgkp.toUpperCase();
    nama_dpn = (nama_dpn ?? "").toString().toUpperCase();
    tmpt_lhr = tmpt_lhr.toUpperCase();
    nama_kantor = nama_kantor.toUpperCase();
    alamat_kantor = alamat_kantor.toUpperCase();
    alamat_rumah = alamat_rumah.toUpperCase();

    const w = {
      no_prop: String(no_prop),
      no_kab: String(no_kab),
      no_kec: String(no_kec),
      no_kel: String(no_kel),
      no_rw: (no_rw ?? "0").toString(),
      no_rt: (no_rt ?? "0").toString(),
    };

    const akunSafe = {
      user_siak: akun?.user_siak ?? null,
      user_bcard: akun?.user_bcard ?? null,
      user_benrol: akun?.user_benrol ?? null,
    };

    // samakan perilaku: "" => NULL
    const normAkun = {
      user_siak: akunSafe.user_siak && akunSafe.user_siak.trim() !== "" ? akunSafe.user_siak.trim() : null,
      user_bcard: akunSafe.user_bcard && akunSafe.user_bcard.trim() !== "" ? akunSafe.user_bcard.trim() : null,
      user_benrol: akunSafe.user_benrol && akunSafe.user_benrol.trim() !== "" ? akunSafe.user_benrol.trim() : null,
    };

    const f = flags ?? {};
    const sup = supervisors ?? {};

    const pejabatSatuRaw = sup.pejabat_satu ?? "";
    const pejabatDuaRaw = sup.pejabat_dua ?? "";

    const pejabatSatu =
      pejabatSatuRaw && pejabatSatuRaw !== "0" ? Number(pejabatSatuRaw) : null;
    const pejabatDua =
      pejabatDuaRaw && pejabatDuaRaw !== "0" ? Number(pejabatDuaRaw) : null;

    await withTransaction(
      async (conn) => {
        // UPDATE SIAK_USER_PLUS — mirror sett_update_userid_data
        const res = await conn.execute(
          `
          UPDATE SIAK_USER_PLUS
             SET NAMA_LGKP        = :b_nama_lgkp,
                 NIK              = :b_nik,
                 TMPT_LHR         = :b_tmpt_lhr,
                 TGL_LHR          = TO_DATE(:b_tgl_lhr,'DD-MM-YYYY'),
                 JENIS_KLMIN      = :b_jenis_klmin,
                 GOL_DRH          = :b_gol_drh,
                 NAMA_KANTOR      = :b_nama_kantor,
                 ALAMAT_KANTOR    = :b_alamat_kantor,
                 TELP             = :b_telp,
                 ALAMAT_RUMAH     = :b_alamat_rumah,
                 USER_LEVEL       = :b_user_level,
                 NO_PROP          = :b_no_prop,
                 NO_KAB           = :b_no_kab,
                 NO_KEC           = :b_no_kec,
                 NO_KEL           = :b_no_kel,
                 NAMA_DPN         = :b_nama_dpn,
                 NO_RW            = :b_no_rw,
                 NO_RT            = :b_no_rt,
                 USER_SIAK        = :b_user_siak,
                 USER_BCARD       = :b_user_bcard,
                 USER_BENROL      = :b_user_benrol,
                 IS_MONITORING    = :b_is_monitoring,
                 IS_GISA          = :b_is_gisa,
                 IS_ABSEN         = :b_is_absen,
                 IS_ASN           = :b_is_asn,
                 ABSENSI_CHECKING = :b_absensi_checking,
                 IS_ACTIVE        = :b_is_active,
                 IPADDRESS_CHECK  = :b_ipaddress_check,
                 IS_SHOW          = :b_is_show,
                 CHANGED_BY       = :b_changed_by,
                 CHANGED_DT       = SYSDATE
           WHERE UPPER(USER_ID)   = UPPER(:b_user_id)
          `,
          {
            b_user_id: userIdParam,
            b_nama_lgkp: nama_lgkp,
            b_nama_dpn: nama_dpn ?? null,
            b_nik: nik,
            b_tmpt_lhr: tmpt_lhr,
            b_tgl_lhr: tgl_lhr,
            b_jenis_klmin: Number(jenis_klmin ?? 1),
            b_gol_drh: Number(gol_drh ?? 13),
            b_nama_kantor: nama_kantor,
            b_alamat_kantor: alamat_kantor,
            b_telp: telp,
            b_alamat_rumah: alamat_rumah,
            b_user_level: String(user_level),
            b_no_prop: w.no_prop,
            b_no_kab: w.no_kab,
            b_no_kec: w.no_kec,
            b_no_kel: w.no_kel,
            b_no_rw: w.no_rw,
            b_no_rt: w.no_rt,
            b_user_siak: normAkun.user_siak,
            b_user_bcard: normAkun.user_bcard,
            b_user_benrol: normAkun.user_benrol,
            b_is_monitoring: toNumFlag(f.is_monitoring),
            b_is_gisa: toNumFlag(f.is_gisa),
            b_is_absen: toNumFlag(f.is_absen),
            b_is_asn: toNumFlag(f.is_asn),
            b_absensi_checking: toNumFlag(f.absensi_checking),
            b_is_active: toNumFlag(f.is_active),
            b_ipaddress_check: toNumFlag(f.ipaddress_check),
            b_is_show: toNumFlag(f.is_show),
            b_changed_by: sess.S_USER_ID,
          },
          { autoCommit: false }
        );

        if (!res.rowsAffected) {
          throw new Error("User tidak ditemukan atau tidak dapat diperbarui");
        }

        // SIAK_ATASAN — versi modern dari sett_update_atasan
        if (pejabatSatu == null && pejabatDua == null) {
          // kalau dua2nya kosong, hapus relasi atasan (boleh beda dari legacy yang cuma UPDATE)
          await conn.execute(
            `
            DELETE FROM SIAK_ATASAN
             WHERE UPPER(USER_ID) = UPPER(:b_user_id)
            `,
            { b_user_id: userIdParam },
            { autoCommit: false }
          );
        } else {
          await conn.execute(
            `
            MERGE INTO SIAK_ATASAN D
            USING (
              SELECT :b_user_id AS USER_ID,
                     :b_pejabat_satu AS ATASAN_SATU,
                     :b_pejabat_dua  AS ATASAN_DUA
                FROM DUAL
            ) S
               ON (D.USER_ID = S.USER_ID)
            WHEN MATCHED THEN
              UPDATE SET D.ATASAN_SATU = S.ATASAN_SATU,
                         D.ATASAN_DUA  = S.ATASAN_DUA
            WHEN NOT MATCHED THEN
              INSERT (USER_ID, ATASAN_SATU, ATASAN_DUA)
              VALUES (S.USER_ID, S.ATASAN_SATU, S.ATASAN_DUA)
            `,
            {
              b_user_id: userIdParam,
              b_pejabat_satu: pejabatSatu,
              b_pejabat_dua: pejabatDua,
            },
            { autoCommit: false }
          );
        }
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "setting/users/update_ok",
      at: "/api/setting/users/[userId]",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { userId: userIdParam },
    });

    return ok({ updated: true }, "User berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/update_err",
      at: "/api/setting/users/[userId]",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal memperbarui user");
  }
  
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { userId } = await params;
    const userIdParam = userId?.trim();
    if (!userIdParam) return badRequest("User ID tidak valid");

    let deletedRows = 0;

    await withTransaction(
      async (conn) => {
        // 1) Hapus backup untuk user ini dulu (sett_del_user_backup)
        await conn.execute(
          `
          DELETE FROM SIAK_USER_PLUS_HIST
           WHERE UPPER(USER_ID) = UPPER(:b_user_id)
          `,
          { b_user_id: userIdParam },
          { autoCommit: false }
        );

        // 2) Backup semua user yang belum ada di HIST (sett_backup_user)
        await conn.execute(
          `
          INSERT INTO SIAK_USER_PLUS_HIST (
            USER_ID, NAMA_LGKP, NIK, TMPT_LHR, TGL_LHR, JENIS_KLMIN, GOL_DRH,
            PENDIDIKAN, PEKERJAAN, NAMA_KANTOR, ALAMAT_KANTOR, TELP, ALAMAT_RUMAH,
            USER_LEVEL, USER_PWD, NO_PROP, NO_KAB, NO_KEC, NO_KEL, NAMA_DPN,
            USER_SIAK, USER_BCARD, USER_BENROL, IS_MONITORING, IS_GISA,
            NO_RW, NO_RT, IS_ABSEN, IS_ASN, ABSENSI_CHECKING, IS_ACTIVE,
            IPADDRESS_CHECK, IS_SHOW, CREATED_BY, CREATED_DT, CHANGED_BY, CHANGED_DT
          )
          SELECT
            B.USER_ID, B.NAMA_LGKP, B.NIK, B.TMPT_LHR, B.TGL_LHR, B.JENIS_KLMIN, B.GOL_DRH,
            B.PENDIDIKAN, B.PEKERJAAN, B.NAMA_KANTOR, B.ALAMAT_KANTOR, B.TELP, B.ALAMAT_RUMAH,
            B.USER_LEVEL, B.USER_PWD, B.NO_PROP, B.NO_KAB, B.NO_KEC, B.NO_KEL, B.NAMA_DPN,
            B.USER_SIAK, B.USER_BCARD, B.USER_BENROL, B.IS_MONITORING, B.IS_GISA,
            B.NO_RW, B.NO_RT, B.IS_ABSEN, B.IS_ASN, B.ABSENSI_CHECKING, B.IS_ACTIVE,
            B.IPADDRESS_CHECK, B.IS_SHOW, B.CREATED_BY, B.CREATED_DT, B.CHANGED_BY, B.CHANGED_DT
          FROM SIAK_USER_PLUS B
          WHERE NOT EXISTS (
            SELECT 1
              FROM SIAK_USER_PLUS_HIST A
             WHERE A.USER_ID = B.USER_ID
          )
          `,
          {},
          { autoCommit: false }
        );

        // 3) Hapus SIAK_ATASAN (sett_delete_atasan)
        await conn.execute(
          `
          DELETE FROM SIAK_ATASAN
           WHERE UPPER(USER_ID) = UPPER(:b_user_id)
          `,
          { b_user_id: userIdParam },
          { autoCommit: false }
        );

        // 4) Hapus user utama (sett_delete_user)
        const delUser = await conn.execute(
          `
          DELETE FROM SIAK_USER_PLUS
           WHERE UPPER(USER_ID) = UPPER(:b_user_id)
          `,
          { b_user_id: userIdParam },
          { autoCommit: false }
        );

        deletedRows = delUser.rowsAffected ?? 0;
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "setting/users/delete_ok",
      at: "/api/setting/users/[userId]",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { userId: userIdParam, deletedRows },
    });

    // Mirror Laravel: selalu dianggap sukses, pesan "User Ini Telah Dihapus !"
    return ok(
      { deleted: deletedRows > 0 },
      "User Ini Telah Dihapus !"
    );
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/delete_err",
      at: "/api/setting/users/[userId]",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err("Gagal menghapus user");
  }
}
