// FILE: src/app/api/setting/app/route.ts
import type { NextRequest } from "next/server";
import { execRows, withTransaction } from "@/lib/db";
import { ok, unauthorized, err, badRequest } from "@/lib/http";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";
import { formatCutoffForDisplay, normalizeCutoffInput } from "@/lib/setting-app";
import type { SettingAppConfig } from "@/types/setting-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/setting/app";
const SYSTEM_TYPE = "INIT_SETING";
const ORACLE_ALIAS = process.env.DB_ALIAS_SETTING ?? "DB";

type MasterRow = {
  SYSTEM_CODE: string;
  SYSTEM_VALUE_TXT?: string | null;
  SYSTEM_VALUE_NUM?: number | null;
};

type FieldMeta = {
  code: string;
  type: "text" | "number";
  fallback?: string;
};

const FIELD_META: Record<keyof SettingAppConfig, FieldMeta> = {
  no_prop: {
    code: "NO_PROP",
    type: "number",
    fallback: process.env.NO_PROP?.trim(),
  },
  no_kab: {
    code: "NO_KAB",
    type: "number",
    fallback: process.env.NO_KAB?.trim(),
  },
  nm_prop: { code: "NM_PROP", type: "text" },
  nm_kab: { code: "NM_KAB", type: "text" },
  siak_dblink: { code: "SIAK_DBLINK", type: "text" },
  cetak_dblink: { code: "CETAK_DBLINK", type: "text" },
  rekam_dblink: { code: "REKAM_DBLINK", type: "text" },
  master_dblink: { code: "MASTER_DBLINK", type: "text" },
  dkb_bio: { code: "DKB_BIO", type: "text" },

  // Ikut legacy: do_get_dkb_keluarga() -> SYSTEM_CODE = 'DKB_KELUARGA'
  dkb_kk: { code: "DKB_KELUARGA", type: "text" },

  // Dipakai showPopulation() (DKB_REF), nanti POST juga sekalian update DKB
  dkb_tahun: { code: "DKB_REF", type: "text" },
  dkb_cutoff: { code: "DKB_CUTOFF", type: "text" },
  default_pass: {
    code: "DEFAULT_PASS",
    type: "text",
    fallback: process.env.SETTING_USER_DEFAULT_PASS?.trim(),
  },
  give_kec: { code: "GIVE_ALL_KEC", type: "number", fallback: "0" },
  give_kel: { code: "GIVE_ALL_KEL", type: "number", fallback: "0" },
};

const FIELD_CODES = Object.values(FIELD_META).map((meta) =>
  meta.code.toUpperCase()
);

function pickRowValue(row: MasterRow | undefined, meta: FieldMeta): string {
  if (!row) return "";
  const txt =
    row.SYSTEM_VALUE_TXT != null ? String(row.SYSTEM_VALUE_TXT).trim() : "";
  const num =
    row.SYSTEM_VALUE_NUM != null &&
    Number.isFinite(Number(row.SYSTEM_VALUE_NUM))
      ? Number(row.SYSTEM_VALUE_NUM)
      : null;

  if (meta.type === "number") {
    if (txt && /^\d+$/.test(txt)) return txt;
    if (num != null) return String(num);
    return txt;
  }

  if (txt) return txt;
  if (num != null) return String(num);
  return "";
}

function mapRowsToConfig(rows: MasterRow[]): SettingAppConfig {
  const map = new Map<string, MasterRow>();
  rows.forEach((row) => {
    if (row?.SYSTEM_CODE) {
      map.set(row.SYSTEM_CODE.trim().toUpperCase(), row);
    }
  });

  const data = {} as SettingAppConfig;
  (Object.keys(FIELD_META) as (keyof SettingAppConfig)[]).forEach((key) => {
    const meta = FIELD_META[key];
    const row = map.get(meta.code.toUpperCase());
    let value = pickRowValue(row, meta);
    if ((!value || !value.length) && meta.fallback) {
      value = meta.fallback;
    }
    if (key === "dkb_cutoff") {
      value = formatCutoffForDisplay(value);
    }
    (data as SettingAppConfig)[key] = value ?? "";
  });

  return data;
}

const UPSERT_SQL = `
  MERGE INTO SIAK_MASTER tgt
  USING (SELECT :b_code AS SYSTEM_CODE FROM DUAL) src
  ON (tgt.SYSTEM_TYPE = :b_type AND tgt.SYSTEM_CODE = src.SYSTEM_CODE)
  WHEN MATCHED THEN
    UPDATE SET SYSTEM_VALUE_TXT = :b_txt, SYSTEM_VALUE_NUM = :b_num
  WHEN NOT MATCHED THEN
    INSERT (SYSTEM_TYPE, SYSTEM_CODE, SYSTEM_VALUE_TXT, SYSTEM_VALUE_NUM)
    VALUES (:b_type, :b_code, :b_txt, :b_num)
`;

export async function GET() {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();
  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const bindPlaceholders = FIELD_CODES.map((_, idx) => `:c${idx}`);
    const binds: Record<string, string> = { b_type: SYSTEM_TYPE };
    FIELD_CODES.forEach((code, idx) => {
      binds[`c${idx}`] = code;
    });

    const rows = await execRows<MasterRow>(
      `
      SELECT SYSTEM_CODE, SYSTEM_VALUE_TXT, SYSTEM_VALUE_NUM
      FROM SIAK_MASTER
      WHERE SYSTEM_TYPE = :b_type
        AND SYSTEM_CODE IN (${bindPlaceholders.join(",")})
      `,
      binds,
      {},
      ORACLE_ALIAS
    );

    const config = mapRowsToConfig(rows);
    const missing = FIELD_CODES.filter(
      (code) =>
        !rows.some(
          (row) => row?.SYSTEM_CODE?.trim().toUpperCase() === code
        )
    );

    await Log.info({
      scope: "API",
      msg: "setting/app/get",
      at: AT,
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { rows: rows.length, missing },
    });

    return ok(config);
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/app/get_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal memuat setting aplikasi");
  }
}

function ensureString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeFlag(value: unknown) {
  const str = String(value ?? "").trim();
  if (str === "1" || str === "0") return str;
  return null;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const sess = await readServerSession();
    if (!sess?.S_USER_ID) return unauthorized();

    const body = (await req.json().catch(() => ({}))) as Partial<SettingAppConfig>;

    const no_prop = ensureString(body.no_prop);
    const no_kab = ensureString(body.no_kab);

    if (!/^\d{1,2}$/.test(no_prop)) {
      return badRequest("No Provinsi wajib 1-2 digit angka", {
        field: "no_prop",
      });
    }
    if (!/^\d{1,2}$/.test(no_kab)) {
      return badRequest("No Kabupaten wajib 1-2 digit angka", {
        field: "no_kab",
      });
    }

    const nm_prop = ensureString(body.nm_prop);
    const nm_kab = ensureString(body.nm_kab);
    const siak_dblink = ensureString(body.siak_dblink);
    const cetak_dblink = ensureString(body.cetak_dblink);
    const rekam_dblink = ensureString(body.rekam_dblink);
    const master_dblink = ensureString(body.master_dblink);
    const dkb_bio = ensureString(body.dkb_bio);
    const dkb_kk = ensureString(body.dkb_kk);
    const dkb_tahun = ensureString(body.dkb_tahun);
    const default_pass = ensureString(body.default_pass);
    const give_kec = normalizeFlag(body.give_kec);
    const give_kel = normalizeFlag(body.give_kel);

    if (!nm_prop) {
      return badRequest("Nama Provinsi wajib diisi", { field: "nm_prop" });
    }
    if (!nm_kab) {
      return badRequest("Nama Kabupaten wajib diisi", { field: "nm_kab" });
    }
    if (!siak_dblink) {
      return badRequest("SIAK DBLink wajib diisi", { field: "siak_dblink" });
    }
    if (!cetak_dblink) {
      return badRequest("Cetak DBLink wajib diisi", { field: "cetak_dblink" });
    }
    if (!rekam_dblink) {
      return badRequest("Rekam DBLink wajib diisi", { field: "rekam_dblink" });
    }
    if (!master_dblink) {
      return badRequest("Monitoring DBLink wajib diisi", {
        field: "master_dblink",
      });
    }
    if (!dkb_bio) {
      return badRequest("DKB Biodata wajib diisi", { field: "dkb_bio" });
    }
    if (!dkb_kk) {
      return badRequest("DKB Keluarga wajib diisi", { field: "dkb_kk" });
    }
    if (!dkb_tahun) {
      return badRequest("Tahun DKB wajib diisi", { field: "dkb_tahun" });
    }
    if (!default_pass) {
      return badRequest("Default Password wajib diisi", {
        field: "default_pass",
      });
    }
    if (give_kec == null) {
      return badRequest("Akses semua kecamatan wajib dipilih", {
        field: "give_kec",
      });
    }
    if (give_kel == null) {
      return badRequest("Akses semua kelurahan wajib dipilih", {
        field: "give_kel",
      });
    }

    const cutoff = normalizeCutoffInput(body.dkb_cutoff ?? "");
    if (!cutoff) {
      return badRequest("DKB Cutoff wajib diisi dengan format DD-MM-YYYY", {
        field: "dkb_cutoff",
      });
    }

    const updates = [
      { code: "NO_PROP", txt: no_prop, num: Number(no_prop) },
      { code: "NO_KAB", txt: no_kab, num: Number(no_kab) },
      { code: "NM_PROP", txt: nm_prop, num: null },
      { code: "NM_KAB", txt: nm_kab, num: null },
      { code: "SIAK_DBLINK", txt: siak_dblink, num: null },
      { code: "CETAK_DBLINK", txt: cetak_dblink, num: null },
      { code: "REKAM_DBLINK", txt: rekam_dblink, num: null },
      { code: "MASTER_DBLINK", txt: master_dblink, num: null },
      { code: "DKB_BIO", txt: dkb_bio, num: null },

      // Ikut legacy: DKB_KELUARGA
      { code: "DKB_KELUARGA", txt: dkb_kk, num: null },

      // Tahun DKB: dipakai di DKB_REF dan DKB sekaligus
      { code: "DKB_REF", txt: dkb_tahun, num: null },
      { code: "DKB", txt: dkb_tahun, num: null },

      { code: "DKB_CUTOFF", txt: cutoff.db, num: null },
      { code: "DEFAULT_PASS", txt: default_pass, num: null },
      { code: "GIVE_ALL_KEC", txt: give_kec, num: Number(give_kec) },
      { code: "GIVE_ALL_KEL", txt: give_kel, num: Number(give_kel) },
    ];

    await withTransaction(
      async (conn) => {
        for (const item of updates) {
          await conn.execute(
            UPSERT_SQL,
            {
              b_type: SYSTEM_TYPE,
              b_code: item.code,
              b_txt: item.txt ?? null,
              b_num: item.num ?? null,
            },
            { autoCommit: false }
          );
        }
      },
      ORACLE_ALIAS
    );

    await Log.info({
      scope: "API",
      msg: "setting/app/save",
      at: AT,
      user: sess.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { updated: updates.length },
    });

    return ok({ updated: updates.length }, "Setting aplikasi berhasil diperbarui");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "setting/app/save_err",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal menyimpan setting aplikasi");
  }
}
