import { execRows } from "@/lib/db";
import {
  fetchAksesFlags,
  fetchKecamatan,
  fetchKabupaten,
  fetchKelurahan,
  resolveWilayahDefaults,
  sanitizeNumberList,
} from "../ktpel/utils";

const ALIAS_DUPLICATE =
  (process.env.KTPDUP_ALIAS ||
    process.env.KTPEL_DUPLICATE_ALIAS ||
    process.env.KTPEL_DB_ALIAS ||
    "DB").toUpperCase();

export {
  fetchAksesFlags,
  fetchKecamatan,
  fetchKabupaten,
  fetchKelurahan,
  resolveWilayahDefaults,
  sanitizeNumberList,
};

export const DuplicateAlias = ALIAS_DUPLICATE;

export type DuplicateDetailRow = {
  nik: string;
  nama: string | null;
  alamat: string | null;
  statusKtp: string | null;
  tglRekam: string | null;
  wilayah: {
    prop: string | null;
    kab: string | null;
    kec: string | null;
    kel: string | null;
  };
  nikSingle: string | null;
  namaSingle: string | null;
  alamatSingle: string | null;
  statusKtpSingle: string | null;
  tglRekamSingle: string | null;
  wilayahSingle: {
    prop: string | null;
    kab: string | null;
    kec: string | null;
    kel: string | null;
  };
};

export type DuplicateListRow = {
  nik: string;
  nikSingle: string | null;
  nama: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  kecamatan: string | null;
  kelurahan: string | null;
  rw: string | null;
  rt: string | null;
  kodePos: string | null;
  agama: string | null;
  statusKawin: string | null;
  pekerjaan: string | null;
  tanggalRekam: string | null;
  statusKtp: string | null;
};

function s(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function mapDuplicateDetailRow(row: Record<string, any>): DuplicateDetailRow {
  return {
    nik: s(row.NIK),
    nama: s(row.NAMA_LGKP) || null,
    alamat: s(row.ALAMAT) || null,
    statusKtp: s(row.CURRENT_STATUS_CODE) || null,
    tglRekam: s(row.TGL_REKAM) || null,
    wilayah: {
      prop: s(row.NAMA_PROP) || null,
      kab: s(row.NAMA_KAB) || null,
      kec: s(row.NAMA_KEC) || null,
      kel: s(row.NAMA_KEL) || null,
    },
    nikSingle: s(row.NIK_SINGLE) || null,
    namaSingle: s(row.NAMA_LGKP_SINGLE) || null,
    alamatSingle: s(row.ALAMAT_SINGLE) || null,
    statusKtpSingle: s(row.CURRENT_STATUS_CODE_SINGLE) || null,
    tglRekamSingle: s(row.TGL_REKAM_SINGLE) || null,
    wilayahSingle: {
      prop: s(row.NAMA_PROP_SINGLE) || null,
      kab: s(row.NAMA_KAB_SINGLE) || null,
      kec: s(row.NAMA_KEC_SINGLE) || null,
      kel: s(row.NAMA_KEL_SINGLE) || null,
    },
  };
}

export function mapDuplicateListRow(row: Record<string, any>): DuplicateListRow {
  return {
    nik: s(row.NIK),
    nikSingle: s(row.NIK_SINGLE) || null,
    nama: s(row.NAMA_LGKP) || null,
    tempatLahir: s(row.TMPT_LHR) || null,
    tanggalLahir: s(row.TGL_LHR) || null,
    alamat: s(row.ALAMAT) || null,
    kecamatan: s(row.NAMA_KEC) || null,
    kelurahan: s(row.NAMA_KEL) || null,
    rw: s(row.NO_RW) || null,
    rt: s(row.NO_RT) || null,
    kodePos: s(row.KODE_POS) || null,
    agama: s(row.AGAMA) || null,
    statusKawin: s(row.STATUS_KAWIN) || null,
    pekerjaan: s(row.PEKERJAAN) || null,
    tanggalRekam: s(row.TGL_REKAM) || null,
    statusKtp: s(row.STATUS_KTP) || null,
  };
}

export async function execDuplicateRows<T = any>(
  sql: string,
  binds: Record<string, any>
): Promise<T[]> {
  return execRows<T>(sql, binds, {}, ALIAS_DUPLICATE);
}
