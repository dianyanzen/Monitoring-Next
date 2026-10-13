export type DatasetType = "KIA" | "AKTA_KELAHIRAN" | "PEREKAMAN_KTPL" | "IKD";

export type DatasetConfig = {
  type: DatasetType;
  label: string;
  table: string;
  fields: Array<{ header: string; column: string }>;
};

const baseFields = [
  { header: "NO", column: "NO" },
  { header: "KODE", column: "KODE" },
  { header: "WILAYAH", column: "WILAYAH" },
];

export const DATASETS: DatasetConfig[] = [
  {
    type: "KIA",
    label: "Kartu Identitas Anak (KIA)",
    table: "PDAK_KIA",
    fields: [
      ...baseFields,
      { header: "JUMLAH AWAL (LK)", column: "JUMLAH_AWAL_LK" },
      { header: "JUMLAH AWAL (PR)", column: "JUMLAH_AWAL_PR" },
      { header: "JUMLAH AWAL (JML)", column: "JUMLAH_AWAL_JML" },
      { header: "MEMILIKI AWAL (LK)", column: "MEMILIKI_AWAL_LK" },
      { header: "MEMILIKI AWAL (PR)", column: "MEMILIKI_AWAL_PR" },
      { header: "MEMILIKI AWAL (JML)", column: "MEMILIKI_AWAL_JML" },
      { header: "BELUM MEMILIKI AWAL (LK)", column: "BELUM_MEMILIKI_AWAL_LK" },
      { header: "BELUM MEMILIKI AWAL (PR)", column: "BELUM_MEMILIKI_AWAL_PR" },
      {
        header: "BELUM MEMILIKI AWAL (JML)",
        column: "BELUM_MEMILIKI_AWAL_JML",
      },
      { header: "PERSEN AWAL (%)", column: "PERSEN_AWAL_PERSEN" },
      { header: "USIA LEBIH TARGET (LK)", column: "USIA_LEBIH_TARGET_LK" },
      { header: "USIA LEBIH TARGET (PR)", column: "USIA_LEBIH_TARGET_PR" },
      { header: "USIA LEBIH TARGET (JML)", column: "USIA_LEBIH_TARGET_JML" },
      { header: "MENINGGAL (LK)", column: "MENINGGAL_LK" },
      { header: "MENINGGAL (PR)", column: "MENINGGAL_PR" },
      { header: "MENINGGAL (JML)", column: "MENINGGAL_JML" },
      { header: "DELETE OPERATOR (LK)", column: "DELETE_OPERATOR_LK" },
      { header: "DELETE OPERATOR (PR)", column: "DELETE_OPERATOR_PR" },
      { header: "DELETE OPERATOR (JML)", column: "DELETE_OPERATOR_JML" },
      { header: "NONAKTIF (LK)", column: "NONAKTIF_LK" },
      { header: "NONAKTIF (PR)", column: "NONAKTIF_PR" },
      { header: "NONAKTIF (JML)", column: "NONAKTIF_JML" },
      { header: "PINDAH (LK)", column: "PINDAH_LK" },
      { header: "PINDAH (PR)", column: "PINDAH_PR" },
      { header: "PINDAH (JML)", column: "PINDAH_JML" },
      { header: "DATANG (LK)", column: "DATANG_LK" },
      { header: "DATANG (PR)", column: "DATANG_PR" },
      { header: "DATANG (JML)", column: "DATANG_JML" },
      { header: "MEMILIKI DALAM DKB (LK)", column: "MEMILIKI_DALAM_DKB_LK" },
      { header: "MEMILIKI DALAM DKB (PR)", column: "MEMILIKI_DALAM_DKB_PR" },
      { header: "MEMILIKI DALAM DKB (JML)", column: "MEMILIKI_DALAM_DKB_JML" },
      { header: "MEMILIKI LUAR DKB (LK)", column: "MEMILIKI_LUAR_DKB_LK" },
      { header: "MEMILIKI LUAR DKB (PR)", column: "MEMILIKI_LUAR_DKB_PR" },
      { header: "MEMILIKI LUAR DKB (JML)", column: "MEMILIKI_LUAR_DKB_JML" },
      { header: "JUMLAH DINAMIS (LK)", column: "JUMLAH_DINAMIS_LK" },
      { header: "JUMLAH DINAMIS (PR)", column: "JUMLAH_DINAMIS_PR" },
      { header: "JUMLAH DINAMIS (TTL)", column: "JUMLAH_DINAMIS_TTL" },
      { header: "MEMILIKI DINAMIS (LK)", column: "MEMILIKI_DINAMIS_LK" },
      { header: "MEMILIKI DINAMIS (PR)", column: "MEMILIKI_DINAMIS_PR" },
      { header: "MEMILIKI DINAMIS (JML)", column: "MEMILIKI_DINAMIS_JML" },
      {
        header: "BELUM MEMILIKI DINAMIS (LK)",
        column: "BELUM_MEMILIKI_DINAMIS_LK",
      },
      {
        header: "BELUM MEMILIKI DINAMIS (PR)",
        column: "BELUM_MEMILIKI_DINAMIS_PR",
      },
      {
        header: "BELUM MEMILIKI DINAMIS (JML)",
        column: "BELUM_MEMILIKI_DINAMIS_JML",
      },
      { header: "PERSEN DINAMIS (%)", column: "PERSEN_DINAMIS_PERSEN" },
      { header: "PENAMBAHAN (LK)", column: "PENAMBAHAN_LK" },
      { header: "PENAMBAHAN (PR)", column: "PENAMBAHAN_PR" },
      { header: "PENAMBAHAN (JML)", column: "PENAMBAHAN_JML" },
    ],
  },
  {
    type: "AKTA_KELAHIRAN",
    label: "Akta Kelahiran",
    table: "PDAK_AKTA_KELAHIRAN_04",
    fields: [
      ...baseFields,
      { header: "WAJIB AKTA (AWAL - LK)", column: "WAJIB_AKTA_AWAL_LK" },
      { header: "WAJIB AKTA (AWAL-PR)", column: "WAJIB_AKTA_AWAL_PR" },
      { header: "WAJIB AKTA (AWAL-JML)", column: "WAJIB_AKTA_AWAL_JML" },
      { header: "MEMILIKI (AWAL-LK)", column: "MEMILIKI_AWAL_LK" },
      { header: "MEMILIKI (AWAL-PR)", column: "MEMILIKI_AWAL_PR" },
      { header: "MEMILIKI (AWAL-JML)", column: "MEMILIKI_AWAL_JML" },
      { header: "BELUM MEMILIKI (AWAL-LK)", column: "BELUM_MEMILIKI_AWAL_LK" },
      { header: "BELUM MEMILIKI (AWAL-PR)", column: "BELUM_MEMILIKI_AWAL_PR" },
      {
        header: "BELUM MEMILIKI (AWAL-JML)",
        column: "BELUM_MEMILIKI_AWAL_JML",
      },
      { header: "PERSEN (AWAL) (%)", column: "PERSEN_AWAL_PERSEN" },
      {
        header: "USIA LEBIH DARI TARGET (LK)",
        column: "USIA_LEBIH_DARI_TARGET_LK",
      },
      {
        header: "USIA LEBIH DARI TARGET (PR)",
        column: "USIA_LEBIH_DARI_TARGET_PR",
      },
      {
        header: "USIA LEBIH DARI TARGET (JML)",
        column: "USIA_LEBIH_DARI_TARGET_JML",
      },
      { header: "MENINGGAL (LK)", column: "MENINGGAL_LK" },
      { header: "MENINGGAL (PR)", column: "MENINGGAL_PR" },
      { header: "MENINGGAL (JML)", column: "MENINGGAL_JML" },
      { header: "NONAKTIF (LK)", column: "NONAKTIF_LK" },
      { header: "NONAKTIF (PR)", column: "NONAKTIF_PR" },
      { header: "NONAKTIF (JML)", column: "NONAKTIF_JML" },
      { header: "PINDAH (LK)", column: "PINDAH_LK" },
      { header: "PINDAH (PR)", column: "PINDAH_PR" },
      { header: "PINDAH (JML)", column: "PINDAH_JML" },
      { header: "DATANG (LK)", column: "DATANG_LK" },
      { header: "DATANG (PR)", column: "DATANG_PR" },
      { header: "DATANG (JML)", column: "DATANG_JML" },
      { header: "DELETE OPERATOR (LK)", column: "DELETE_OPERATOR_LK" },
      { header: "DELETE OPERATOR (PR)", column: "DELETE_OPERATOR_PR" },
      { header: "DELETE OPERATOR (JML)", column: "DELETE_OPERATOR_JML" },
      {
        header: "TERBIT AKTA BARU (DALAM DKB - LK)",
        column: "TERBIT_AKTA_BARU_DALAM_DKB_LK",
      },
      {
        header: "TERBIT AKTA BARU (DALAM DKB - PR)",
        column: "TERBIT_AKTA_BARU_DALAM_DKB_PR",
      },
      {
        header: "TERBIT AKTA BARU (DALAM DKB - JML)",
        column: "TERBIT_AKTA_BARU_DALAM_DKB_JML",
      },
      {
        header: "TERBIT AKTA BARU (LUAR DKB - LK)",
        column: "TERBIT_AKTA_BARU_LUAR_DKB_LK",
      },
      {
        header: "TERBIT AKTA BARU (LUAR DKB - PR)",
        column: "TERBIT_AKTA_BARU_LUAR_DKB_PR",
      },
      {
        header: "TERBIT AKTA BARU (LUAR DKB - JML)",
        column: "TERBIT_AKTA_BARU_LUAR_DKB_JML",
      },
      { header: "WAJIB AKTA (DINAMIS - LK)", column: "WAJIB_AKTA_DINAMIS_LK" },
      { header: "WAJIB AKTA (DINAMIS - PR)", column: "WAJIB_AKTA_DINAMIS_PR" },
      {
        header: "WAJIB AKTA (DINAMIS - JML)",
        column: "WAJIB_AKTA_DINAMIS_JML",
      },
      { header: "MEMILIKI (DINAMIS - LK)", column: "MEMILIKI_DINAMIS_LK" },
      { header: "MEMILIKI (DINAMIS - PR)", column: "MEMILIKI_DINAMIS_PR" },
      { header: "MEMILIKI (DINAMIS - JML)", column: "MEMILIKI_DINAMIS_JML" },
      {
        header: "BELUM MEMILIKI (DINAMIS - LK)",
        column: "BELUM_MEMILIKI_DINAMIS_LK",
      },
      {
        header: "BELUM MEMILIKI (DINAMIS - PR)",
        column: "BELUM_MEMILIKI_DINAMIS_PR",
      },
      {
        header: "BELUM MEMILIKI (DINAMIS - JML)",
        column: "BELUM_MEMILIKI_DINAMIS_JML",
      },
      { header: "PERSEN (DINAMIS) (%)", column: "PERSEN_DINAMIS_PERSEN" },
      { header: "PENAMBAHAN (LK)", column: "PENAMBAHAN_LK" },
      { header: "PENAMBAHAN (PR)", column: "PENAMBAHAN_PR" },
      { header: "PENAMBAHAN (JML)", column: "PENAMBAHAN_JML" },
    ],
  },
  {
    type: "PEREKAMAN_KTPL",
    label: "Perekaman KTP-el",
    table: "PDAK_PEREKAMAN_KTPL",
    fields: [
      ...baseFields,
      { header: "JUMLAH PENDUDUK", column: "JUMLAH_PENDUDUK" },
      { header: "WKTP AWAL", column: "WKTP_AWAL" },
      { header: "PEREKAMAN AWAL", column: "PEREKAMAN_AWAL" },
      { header: "BELUM PEREKAMAN AWAL", column: "BELUM_PEREKAMAN_AWAL" },
      { header: "PERSENTASE AWAL", column: "PERSENTASE_AWAL" },
      { header: "MENINGGAL", column: "MENINGGAL" },
      { header: "DUPLIKAT", column: "DUPLIKAT" },
      { header: "NONAKTIF", column: "NONAKTIF" },
      {
        header: "DELETE OPERATOR/NONAKTIF DAERAH",
        column: "DELETE_OPERATOR_NONAKTIF_DAERA",
      },
      { header: "PINDAH", column: "PINDAH" },
      { header: "DATANG", column: "DATANG" },
      {
        header: "REKAM TUNGGAL BARU DALAM DKB",
        column: "REKAM_TUNGGAL_BARU_DALAM_DKB",
      },
      {
        header: "REKAM TUNGGAL BARU LUAR DKB",
        column: "REKAM_TUNGGAL_BARU_LUAR_DKB",
      },
      { header: "PEMULA 17 THN HARI INI", column: "PEMULA_17_THN_HARI_INI" },
      { header: "WKTP DINAMIS", column: "WKTP_DINAMIS" },
      { header: "PROGRES REKAM", column: "PROGRES_REKAM" },
      { header: "PROGRES BELUM REKAM", column: "PROGRES_BELUM_REKAM" },
      { header: "PROGRES PERSENTASE", column: "PROGRES_PERSENTASE" },
      { header: "PENAMBAHAN PEREKAMAN", column: "PENAMBAHAN_PEREKAMAN" },
    ],
  },
  {
    type: "IKD",
    label: "Aktivasi Identitas Kependudukan Digital (IKD)",
    table: "PDAK_IKD",
    fields: [
      ...baseFields,
      { header: "REKAM DINAMIS", column: "REKAM_DINAMIS" },
      { header: "JUMLAH IKD", column: "JUMLAH_IKD" },
      { header: "PERSEN IKD", column: "PERSEN_IKD" },
    ],
  },
];

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}
