import type { NextRequest } from "next/server";
import { badRequest, err, ok, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_CETAK_DINAS ?? process.env.DB_ALIAS_PRR ?? "DB222";

function sanitizeNik(raw: unknown) {
  const nik = String(raw ?? "")
    .trim()
    .replace(/[^\d]/g, "");
  return nik;
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Sesi tidak valid.");

    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const nik = sanitizeNik(body.nik);
    if (nik.length !== 16) return badRequest("NIK wajib 16 digit.");

    const sql = `
      SELECT
        A.NIK,
        A.NAMA_LGKP,
        A.NO_KEC,
        F5_GET_NAMA_KECAMATAN(32,73,A.NO_KEC) AS NAMA_KEC,
        TRUNC(MONTHS_BETWEEN(A.PRINTED_DATE,B.TGL_LHR)/12) AS UMUR,
        TO_CHAR(A.PRINTED_DATE,'DD-MM-YYYY') AS TGL_CETAK,
        B.TMPT_LHR,
        TO_CHAR(B.TGL_LHR,'DD-MM-YYYY') AS TGL_LHR,
        UPPER(F5_GET_REF_WNI(F5_TO_NUMBER(B.JENIS_KLMIN,7), 801)) AS JENIS_KLMIN,
        UPPER(F5_GET_REF_WNI(B.GOL_DRH, 401)) AS GOL_DRH,
        UPPER(F5_GET_REF_WNI(F5_TO_NUMBER(B.AGAMA,7), 501)) AS AGAMA,
        D.ALAMAT,
        LPAD(TO_CHAR(D.NO_RT), 3, '0') AS RT,
        LPAD(TO_CHAR(D.NO_RW), 3, '0') AS RW,
        CASE WHEN D.KODE_POS IS NULL THEN '-' ELSE TO_CHAR(D.KODE_POS) END AS KODE_POS,
        B.NIK_IBU,
        B.NAMA_LGKP_IBU,
        B.NIK_AYAH,
        B.NAMA_LGKP_AYAH,
        B.NO_KK,
        B.NO_PROP ||' - '|| F5_GET_NAMA_PROVINSI(B.NO_PROP) AS PROVINSI,
        B.NO_KAB ||' - '|| F5_GET_NAMA_KABUPATEN(B.NO_PROP, B.NO_KAB) AS KABUPATEN,
        B.NO_KEC ||' - '|| F5_GET_NAMA_KECAMATAN(B.NO_PROP, B.NO_KAB, B.NO_KEC) AS KECAMATAN,
        B.NO_KEL ||' - '|| F5_GET_NAMA_KELURAHAN(B.NO_PROP, B.NO_KAB, B.NO_KEC, B.NO_KEL) AS KELURAHAN,
        B.NO_AKTA_LHR,
        C.ANAK_KE,
        TO_CHAR(C.CREATED_DATE,'DD-MM-YYYY') AS CREATED_DATE,
        C.CREATED_BY,
        E.PATH
      FROM (
        SELECT SEQN_ID, NO_DOKUMEN, NIK, NAMA_LGKP, JENIS_KLMIN, NO_KK, ALAMAT, PRINT_TYPE, STATUS_BLANGKO,
               PRINTED_BY, PRINTED_DATE, CHECKED_BY, CHECKED_DATE, REVOKED_BY, REVOKED_DATE,
               NO_BLANGKO, NO_PROP, NO_KAB, NO_KEC, NO_KEL, FILENAME, TIPE_DOK
        FROM (
          SELECT SEQN_ID, NO_DOKUMEN, NIK, NAMA_LGKP, JENIS_KLMIN, NO_KK, ALAMAT, PRINT_TYPE, STATUS_BLANGKO,
                 PRINTED_BY, PRINTED_DATE, CHECKED_BY, CHECKED_DATE, REVOKED_BY, REVOKED_DATE,
                 NO_BLANGKO, NO_PROP, NO_KAB, NO_KEC, NO_KEL, FILENAME, TIPE_DOK,
                 RANK() OVER (PARTITION BY NIK ORDER BY PRINTED_DATE DESC, SEQN_ID DESC) RNK
          FROM T5_SEQN_KIA_PRINT
        )
        WHERE RNK = 1
      ) A
      LEFT JOIN LTS_KIA C ON A.NIK = C.NIK
      LEFT JOIN BIODATA_WNI B ON A.NIK = B.NIK
      LEFT JOIN DATA_KELUARGA D ON B.NO_KK = D.NO_KK
      LEFT JOIN T5_FOTO E ON B.NIK = E.NIK
      WHERE A.NIK = :nik
    `;

    const rows = await execRows<any>(sql, { nik }, {}, ORACLE_ALIAS);
    const found = rows?.[0];
    const data = found
      ? {
          isExists: true,
          nik: String(found.NIK ?? "").trim(),
          nama: String(found.NAMA_LGKP ?? "").trim(),
          noKec: String(found.NO_KEC ?? "").trim() || "0",
          namaKec: String(found.NAMA_KEC ?? "").trim(),
          jenisKelamin: found.JENIS_KLMIN ?? null,
          ttl: [found.TMPT_LHR, found.TGL_LHR].filter(Boolean).join(" / "),
          golonganDarah: found.GOL_DRH ?? null,
          umur: found.UMUR != null ? `${found.UMUR} Tahun` : null,
          agama: found.AGAMA ?? null,
          nikIbu: found.NIK_IBU ?? null,
          namaIbu: found.NAMA_LGKP_IBU ?? null,
          nikAyah: found.NIK_AYAH ?? null,
          namaAyah: found.NAMA_LGKP_AYAH ?? null,
          noKk: found.NO_KK ?? null,
          provinsi: found.PROVINSI ?? null,
          kabupaten: found.KABUPATEN ?? null,
          kecamatan: found.KECAMATAN ?? null,
          kelurahan: found.KELURAHAN ?? null,
          alamat: found.ALAMAT ?? null,
          rt: found.RT ?? null,
          rw: found.RW ?? null,
          kodePos: found.KODE_POS ?? null,
          anakKe: found.ANAK_KE ?? null,
          tglPengajuan: found.CREATED_DATE ?? null,
          petugas: found.CREATED_BY ?? null,
          tglCetak: found.TGL_CETAK ?? null,
          fotoPath:
            found.PATH && found.PATH !== ""
              ? `http://10.32.73.222:8080/Siak/${found.PATH}/${found.NIK}.jpg`
              : null,
        }
      : { isExists: false };

    await Log.info({
      scope: "API",
      msg: "cetak_dinas/get_nik_kia",
      at: "/api/cetak_dinas/get_nik_kia",
      user: session.S_USER_ID,
      tookMs: Date.now() - started,
      extra: { nik, found: !!found },
    });

    return ok(data, found ? "Data ditemukan" : "Data tidak ditemukan");
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "cetak_dinas/get_nik_kia_err",
      at: "/api/cetak_dinas/get_nik_kia",
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err("Gagal mengambil data NIK.", 500);
  }
}
