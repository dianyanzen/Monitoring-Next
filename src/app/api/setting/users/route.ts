// FILE: src/app/api/setting/users/route.ts
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { readServerSession, getClientInfo } from "@/lib/session";
import { ok, unauthorized, err, badRequest } from "@/lib/http";
import { execRows, execOne, execDml } from "@/lib/db";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";
const DEFAULT_LIMIT = Number(process.env.SETTING_USER_LIMIT ?? 200);
const MAX_LIMIT = 500;

type RawUserRow = {
  USER_ID: string;
  NAMA_LGKP: string;
  NAMA_DPN: string | null;
  NIK: string;
  USER_LEVEL: number | string;
  LEVEL_NAME: string | null;
  GROUP_NAME: string | null;
  IS_ACTIVE: number | string | null;
};

const sanitizeLike = (s: string) => s.replace(/[%_]/g, "").toUpperCase();
const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
const normalizeUpper = (s: string) => s?.toString().trim().toUpperCase() ?? "";
const md5 = (input: string) => crypto.createHash("md5").update(input).digest("hex");

const boolTo01 = (flag: boolean | number | string | undefined | null) => {
  if (flag === null || flag === undefined) return 0;
  if (typeof flag === "boolean") return flag ? 1 : 0;
  if (typeof flag === "number") return flag === 1 ? 1 : 0;
  const upper = String(flag).trim().toUpperCase();
  return upper === "1" || upper === "YA" || upper === "TRUE" ? 1 : 0;
};

const toSupervisorId = (value?: string | number | null) => {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
};

async function upsertSupervisors(
  userId: string,
  pejabatSatu: number | null,
  pejabatDua: number | null
) {
  await execDml(
    `
    MERGE INTO SIAK_ATASAN tgt
    USING (SELECT :b_uid AS USER_ID FROM DUAL) src
    ON (tgt.USER_ID = src.USER_ID)
    WHEN MATCHED THEN
      UPDATE SET ATASAN_SATU = :b_satu, ATASAN_DUA = :b_dua
    WHEN NOT MATCHED THEN
      INSERT (USER_ID, ATASAN_SATU, ATASAN_DUA)
      VALUES (:b_uid, :b_satu, :b_dua)
    `,
    { b_uid: userId, b_satu: pejabatSatu, b_dua: pejabatDua },
    {},
    ORACLE_ALIAS
  );
}

/* ================================
   GET: list user
   ================================ */
export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const { searchParams } = new URL(req.url);
    const levelParam = (searchParams.get("level_id") ?? "").trim();
    const userIdParam = (searchParams.get("user_id") ?? "").trim();
    const userNmParam = (searchParams.get("user_nm") ?? "").trim();
    const limitParam = Number(searchParams.get("limit") ?? "");

    const levelId = levelParam ? levelParam.replace(/[^\d]/g, "") : "";
    const userId = userIdParam ? sanitizeLike(userIdParam) : "";
    const userNm = userNmParam ? sanitizeLike(userNmParam) : "";
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), MAX_LIMIT)
        : Math.min(DEFAULT_LIMIT, MAX_LIMIT);

    const filters: string[] = [];
    const binds: Record<string, unknown> = { b_limit: limit };

    if (levelId) {
      filters.push("U.USER_LEVEL = :b_level");
      binds.b_level = levelId;
    }
    if (userId) {
      filters.push("UPPER(U.USER_ID) LIKE :b_uid");
      binds.b_uid = `%${userId}%`;
    }
    if (userNm) {
      filters.push("UPPER(U.NAMA_LGKP) LIKE :b_unm");
      binds.b_unm = `%${userNm}%`;
    }

    const whereClause = filters.length ? filters.join(" AND ") : "1=1";

    const sql = `
      SELECT * FROM (
        SELECT
          U.USER_ID,
          U.NAMA_LGKP,
          U.NAMA_DPN,
          U.NIK,
          U.USER_LEVEL,
          L.LEVEL_NAME,
          G.LEVEL_NAME AS GROUP_NAME,
          U.IS_ACTIVE,
          ROW_NUMBER() OVER (ORDER BY U.NAMA_LGKP) AS RN
        FROM SIAK_USER_PLUS U
        LEFT JOIN SIAK_USER_LEVEL L ON L.USER_LEVEL = U.USER_LEVEL
        LEFT JOIN SIAK_USER_GROUP G ON G.LEVEL_CODE = L.GROUP_LEVEL
        WHERE ${whereClause}
      )
      WHERE RN <= :b_limit
    `;

    const rows = await execRows<RawUserRow>(sql, binds, {}, ORACLE_ALIAS);

    const data = rows.map((r, idx) => ({
      no: idx + 1,
      user_id: r.USER_ID?.trim() ?? "",
      nama_lgkp: r.NAMA_LGKP?.trim() ?? "",
      nama_dpn: r.NAMA_DPN?.trim() ?? "",
      nik: r.NIK?.trim() ?? "",
      user_level: r.USER_LEVEL?.toString() ?? "",
      level_name: r.LEVEL_NAME?.trim() ?? "",
      group_name: r.GROUP_NAME?.trim() ?? "",
      is_active: Number(r.IS_ACTIVE ?? 0) === 1,
    }));

    await Log.info({
      scope: "API",
      msg: "setting/users/list_ok",
      at: "/api/setting/users",
      user: sess.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { count: data.length, levelId, userId: userIdParam, userNm: userNmParam },
    });

    return ok({ rows: data, limit });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/list_err",
      at: "/api/setting/users",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal memuat daftar user");
  }
}

/* ================================
   POST: create user baru
   ================================ */
type SavePayload = {
  user_id?: string;
  nama_lgkp?: string;
  nama_dpn?: string;
  nik?: string;
  tmpt_lhr?: string;
  tgl_lhr?: string;
  jenis_klmin?: number | string;
  gol_drh?: number | string;
  nama_kantor?: string;
  alamat_kantor?: string;
  telp?: string;
  alamat_rumah?: string;

  level_group?: string | number; // 1=KAB/KOTA, 2=KEC, 3=DESA/KELURAHAN
  user_level?: string; // kode level (mis. 5 = TEAM IT)

  wilayah?: {
    no_prop?: string;
    no_kab?: string;
    no_kec?: string;
    no_kel?: string;
    no_rw?: string;
    no_rt?: string;
  };
  akun?: {
    user_siak?: string;
    user_bcard?: string;
    user_benrol?: string;
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
  supervisors?: { pejabat_satu?: string; pejabat_dua?: string };
  new_password?: string;
};

function validatePayload(body: SavePayload): string | null {
  const requiredText = [
    ["user_id", body.user_id],
    ["nama_lgkp", body.nama_lgkp],
    ["nama_dpn", body.nama_dpn],
    ["nik", body.nik],
    ["tmpt_lhr", body.tmpt_lhr],
    ["tgl_lhr", body.tgl_lhr],
    ["nama_kantor", body.nama_kantor],
    ["alamat_kantor", body.alamat_kantor],
    ["telp", body.telp],
    ["alamat_rumah", body.alamat_rumah],
  ] as const;

  for (const [label, value] of requiredText) {
    if (!value || !String(value).trim()) return `Field ${label} wajib diisi`;
  }

  const levelGroup = String(body.level_group ?? "").trim();
  if (!levelGroup) return "Level user wajib dipilih";
  if (!body.user_level) return "Group user wajib dipilih";

  const wilayah = body.wilayah ?? {};
  const noProp = wilayah.no_prop?.trim() ?? "";
  const noKab = wilayah.no_kab?.trim() ?? "";
  const noKec = wilayah.no_kec?.trim() ?? "";
  const noKel = wilayah.no_kel?.trim() ?? "";

  if (!noProp || !noKab) return "Provinsi dan kabupaten wajib diisi";

  if (levelGroup === "1") {
    // KAB/KOTA → kec/kel boleh kosong (akan di-set 0 di server)
  } else if (levelGroup === "2") {
    if (!noKec) return "Kecamatan wajib diisi untuk level Kecamatan";
  } else if (levelGroup === "3") {
    if (!noKec) return "Kecamatan wajib diisi untuk level Kelurahan";
    if (!noKel) return "Kelurahan wajib diisi untuk level Kelurahan";
  } else {
    // fallback: wajib lengkap
    if (!noKec || !noKel) return "Wilayah penugasan belum lengkap";
  }

  if (!/^\d{16}$/.test(String(body.nik).trim())) return "NIK harus 16 digit";
  if (!/^\d{2}-\d{2}-\d{4}$/.test(String(body.tgl_lhr).trim()))
    return "Format tanggal lahir harus DD-MM-YYYY";

  if (
    body.supervisors?.pejabat_satu &&
    body.supervisors?.pejabat_dua &&
    body.supervisors.pejabat_satu === body.supervisors.pejabat_dua
  ) {
    return "Atasan satu dan dua tidak boleh sama";
  }

  return null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();
    const { ip, ua } = await getClientInfo();

    const body = (await req.json().catch(() => null)) as SavePayload | null;
    if (!body) return badRequest("Payload tidak valid");

    const validation = validatePayload(body);
    if (validation) return badRequest(validation);

    const userId = normalizeUpper(body.user_id!);
    const exists = await execOne<{ CNT: number }>(
      `SELECT COUNT(1) AS CNT FROM SIAK_USER_PLUS WHERE UPPER(USER_ID) = :b_uid`,
      { b_uid: userId },
      {},
      ORACLE_ALIAS
    );
    if (Number(exists?.CNT ?? 0) > 0) return badRequest(`User ${userId} sudah terdaftar`);

    const wilayahBody = body.wilayah ?? {};
    const akun = body.akun ?? {};
    const flags = body.flags ?? {};
    const levelGroup = String(body.level_group ?? "").trim();

    // Normalisasi wilayah sesuai kdgroup (legacy sett_insert_userid_data)
    let no_prop = wilayahBody.no_prop?.trim() ?? "";
    let no_kab = wilayahBody.no_kab?.trim() ?? "";
    let no_kec = wilayahBody.no_kec?.trim() ?? "";
    let no_kel = wilayahBody.no_kel?.trim() ?? "";

    if (levelGroup === "1") {
      // KAB/KOTA → KEC/KEL = 0
      no_kec = "0";
      no_kel = "0";
    } else if (levelGroup === "2") {
      // KECAMATAN → KEL = 0
      no_kel = "0";
    } else if (levelGroup === "3") {
      // DESA/KELURAHAN → pakai kec/kel apa adanya
    } else {
      // fallback: biarkan apa adanya
    }

    const no_rw = onlyDigits(wilayahBody.no_rw ?? "0") || "0";
    const no_rt = onlyDigits(wilayahBody.no_rt ?? "0") || "0";

    const passwordPlain =
      (body.new_password?.trim() || process.env.SETTING_USER_DEFAULT_PASS || "123456").trim();
    if (passwordPlain.length < 4) return badRequest("Password minimal 4 karakter");

    await execDml(
      `
      INSERT INTO SIAK_USER_PLUS (
        USER_ID, NAMA_LGKP, NAMA_DPN, NIK,
        TMPT_LHR, TGL_LHR, JENIS_KLMIN, GOL_DRH,
        NAMA_KANTOR, ALAMAT_KANTOR, TELP, ALAMAT_RUMAH,
        USER_LEVEL,
        NO_PROP, NO_KAB, NO_KEC, NO_KEL, NO_RW, NO_RT,
        USER_SIAK, USER_BCARD, USER_BENROL,
        IS_MONITORING, IS_GISA, IS_ABSEN, IS_ASN, ABSENSI_CHECKING,
        IS_ACTIVE, IPADDRESS_CHECK, IS_SHOW,
        USER_PWD,
        CREATED_AT
      )
      VALUES (
        :b_user_id, :b_nama_lgkp, :b_nama_dpn, :b_nik,
        :b_tmpt_lhr, TO_DATE(:b_tgl_lhr,'DD-MM-YYYY'), :b_jk, :b_gol,
        :b_nama_kantor, :b_alamat_kantor, :b_telp, :b_alamat_rumah,
        :b_user_level,
        :b_no_prop, :b_no_kab, :b_no_kec, :b_no_kel, :b_no_rw, :b_no_rt,
        :b_user_siak, :b_user_bcard, :b_user_benrol,
        :b_is_monitoring, :b_is_gisa, :b_is_absen, :b_is_asn, :b_absensi_checking,
        :b_is_active, :b_ip_check, :b_is_show,
        :b_user_pwd,
        SYSTIMESTAMP
      )
      `,
      {
        b_user_id: userId,
        b_nama_lgkp: body.nama_lgkp?.trim() ?? "",
        b_nama_dpn: body.nama_dpn?.trim() ?? "",
        b_nik: onlyDigits(body.nik ?? ""),
        b_tmpt_lhr: body.tmpt_lhr?.trim() ?? "",
        b_tgl_lhr: body.tgl_lhr?.trim() ?? "",
        b_jk: Number(body.jenis_klmin ?? 0) || null,
        b_gol: Number(body.gol_drh ?? 0) || null,
        b_nama_kantor: body.nama_kantor?.trim() ?? "",
        b_alamat_kantor: body.alamat_kantor?.trim() ?? "",
        b_telp: body.telp?.trim() ?? "",
        b_alamat_rumah: body.alamat_rumah?.trim() ?? "",
        b_user_level: body.user_level?.trim() ?? "",
        b_no_prop: no_prop,
        b_no_kab: no_kab,
        b_no_kec: no_kec,
        b_no_kel: no_kel,
        b_no_rw: no_rw,
        b_no_rt: no_rt,
        b_user_siak: akun.user_siak?.trim() ?? null,
        b_user_bcard: akun.user_bcard?.trim() ?? null,
        b_user_benrol: akun.user_benrol?.trim() ?? null,
        b_is_monitoring: boolTo01(flags.is_monitoring),
        b_is_gisa: boolTo01(flags.is_gisa),
        b_is_absen: boolTo01(flags.is_absen),
        b_is_asn: boolTo01(flags.is_asn),
        b_absensi_checking: boolTo01(flags.absensi_checking),
        b_is_active: boolTo01(flags.is_active ?? "1"),
        b_ip_check: boolTo01(flags.ipaddress_check),
        b_is_show: boolTo01(flags.is_show),
        b_user_pwd: md5(passwordPlain),
      },
      { autoCommit: true },
      ORACLE_ALIAS
    );

    const supervisorSatu = toSupervisorId(body.supervisors?.pejabat_satu);
    const supervisorDua = toSupervisorId(body.supervisors?.pejabat_dua);
    await upsertSupervisors(userId, supervisorSatu, supervisorDua);

    await Log.info({
      scope: "API",
      msg: "setting/users/create",
      at: "/api/setting/users",
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { userId, level_group: levelGroup, user_level: body.user_level },
    });

    return ok({ user_id: userId, default_password: passwordPlain }, "User berhasil dibuat");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/users/create_err",
      at: "/api/setting/users",
      tookMs: Date.now() - started,
      err: { name: e?.name || "Error", message: e?.message || String(e) },
    });
    return err(e?.message || "Gagal menambahkan user baru");
  }
}
