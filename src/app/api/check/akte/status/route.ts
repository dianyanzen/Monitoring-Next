import { ok, err, badRequest } from "@/lib/http";
import { execRows } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Kind =
  | "BAKAK"
  | "KELAHIRAN"
  | "KEMATIAN"
  | "LAHIR_MATI"
  | "TAU"
  | "PGK"
  | "PGS"
  | "CERAI"
  | "KAWIN";

/* ===== Helpers ===== */

// terima list lewat GET/POST, hapus spasi/tab, izinkan -, /, .
function parseList(raw?: string | null) {
  const txt = String(raw ?? "").toUpperCase();
  const merged = txt.replace(/[\r\n;]+/g, ",");
  const tokens = merged
    .split(",")
    .map((t) =>
      t
        .replace(/[ \t]+/g, "")          // buang spasi/tab di DALAM nomor
        .replace(/[^A-Z0-9\-\/\.]/g, "") // izinkan -, /, .
        .replace(/\.+$/g, "")            // buang titik di ujung
        .trim()
    )
    .filter(Boolean);

  // unik dengan urutan terjaga
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of tokens) if (!seen.has(v)) { seen.add(v); out.push(v); }
  return out;
}

// SESUAI PERMINTAAN: deteksi hanya prefix 3273- (selain itu/fmt aneh => BAKAK)
function detectKind(noAkte: string): Kind {
  const s = (noAkte || "").toUpperCase().trim();

  // format arsip/”liar” → langsung BAKAK
  if (/[\/.]/.test(s)) return "BAKAK";

  if (s.startsWith("3273-LMWNI")) return "LAHIR_MATI";
  if (s.startsWith("3273-LMOA"))  return "LAHIR_MATI";
  if (s.startsWith("3273-LT-TU")) return "TAU";
  if (s.startsWith("3273-LU-TU")) return "TAU";
  if (s.startsWith("3273-PGKUA")) return "PGK";
  if (s.startsWith("3273-PGSH"))  return "PGS";
  if (s.startsWith("3273-KM"))    return "KEMATIAN";
  if (s.startsWith("3273-CR"))    return "CERAI";
  if (s.startsWith("3273-KW"))    return "KAWIN";
  if (s.startsWith("3273-LT"))    return "KELAHIRAN";
  if (s.startsWith("3273-LU"))    return "KELAHIRAN";

  return "BAKAK";
}

function buildSql(kind: Kind) {
  const map: Record<Kind, { table: string; jns: string; nikExpr: string; namaExpr: string }> = {
    BAKAK:      { table: "bsre_bakak",           jns: "AKTA BAKAK",            nikExpr: "BAYI_NIK",                    namaExpr: "BAYI_NAMA_LGKP" },
    KELAHIRAN:  { table: "bsre_kelahiran",       jns: "AKTA KELAHIRAN",        nikExpr: "BAYI_NIK",                    namaExpr: "BAYI_NAMA_LGKP" },
    KEMATIAN:   { table: "bsre_kematian",        jns: "AKTA KEMATIAN",         nikExpr: "MATI_NIK",                    namaExpr: "MATI_NAMA_LGKP" },
    LAHIR_MATI: { table: "bsre_lahir_mati",      jns: "AKTA LAHIR MATI",       nikExpr: "'-'",                         namaExpr: "'-'" },
    TAU:        { table: "bsre_kelahiran_tau",   jns: "AKTA TANPA ASAL USUL",  nikExpr: "BAYI_NIK",                    namaExpr: "BAYI_NAMA_LGKP" },
    PGK:        { table: "bsre_pengakuan_anak",  jns: "AKTA PENGAKUAN ANAK",   nikExpr: "ANAK_NIK",                    namaExpr: "ANAK_NAMA_LGKP" },
    PGS:        { table: "bsre_pengesahan_anak", jns: "AKTA PENGESAHAN ANAK",  nikExpr: "ANAK_NIK",                    namaExpr: "ANAK_NAMA_LGKP" },
    CERAI:      { table: "bsre_perceraian",      jns: "AKTA PERCERAIAN",       nikExpr: "SUAMI_NIK||' & '||ISTRI_NIK", namaExpr: "SUAMI_NAMA_LGKP||' & '||ISTRI_NAMA_LGKP" },
    KAWIN:      { table: "bsre_perkawinan",      jns: "AKTA PERKAWINAN",       nikExpr: "SUAMI_NIK||' & '||ISTRI_NIK", namaExpr: "SUAMI_NAMA_LGKP||' & '||ISTRI_NAMA_LGKP" },
  };
  const cfg = map[kind];

  return `
    SELECT
      NO_DOC,
      NIK_VAL AS NIK,
      NAMA_VAL AS NAMA_LGKP,
      '${cfg.jns}' AS JNS_AKTA,
      CASE WHEN CERT_STATUS IS NULL THEN '-' ELSE TO_CHAR(CERT_STATUS) END AS CERT_STATUS,
      1 AS JML_PENGAJUAN,
      CASE WHEN REQ_DATE IS NULL THEN '-' ELSE TO_CHAR(REQ_DATE,'DD-MM-YYYY') END AS REQ_DATE,
      CASE WHEN REQ_BY   IS NULL THEN '-' ELSE TO_CHAR(REQ_BY) END AS REQ_BY,
      CASE WHEN URL_DOKUMEN IS NULL THEN '-' ELSE TO_CHAR(URL_DOKUMEN) END AS URL_DOKUMEN,
      CASE WHEN URL_DOKUMEN IS NULL THEN '-' ELSE SUBSTR(URL_DOKUMEN,20) END AS URL_KK,
      CASE WHEN URL_DOKUMEN IS NULL THEN '-' ELSE SUBSTR(URL_DOKUMEN,11,8) END AS URL_DATE,
      CASE WHEN URL_DOKUMEN IS NULL THEN '-'
           ELSE 'http://10.32.73.7:8080/monitoring/pengajuan/tmpcetak/' || SUBSTR(URL_DOKUMEN,11,8) || '/' || SUBSTR(URL_DOKUMEN,20) || '.pdf'
      END AS URL_DOWNLOAD,
      CASE WHEN URL_DOKUMEN IS NULL THEN '-'
           ELSE 'http://10.32.73.7:8080/monitoring/pengajuan/tmpcetak/' || SUBSTR(URL_DOKUMEN,11,8) || '/' || REPLACE(SUBSTR(URL_DOKUMEN,20), '_sign', '_reg_sign') || '.pdf'
      END AS URL_REGISTER,
      CASE WHEN PEJABAT_PROCESS_DATE IS NULL THEN '-' ELSE TO_CHAR(PEJABAT_PROCESS_DATE,'DD-MM-YYYY') END AS APROVE_DATE
    FROM (
      SELECT
        NO_DOKUMEN AS NO_DOC,
        ${cfg.nikExpr}  AS NIK_VAL,
        ${cfg.namaExpr} AS NAMA_VAL,
        CERT_STATUS,
        REQ_DATE,
        REQ_BY,
        SEQN_ID,
        URL_DOKUMEN,
        PEJABAT_PROCCESS_BY,
        PEJABAT_PROCESS_DATE,
        RANK() OVER (PARTITION BY NO_DOKUMEN ORDER BY REQ_DATE DESC, SEQN_ID DESC) AS RNK
      FROM ${cfg.table}
    )
    WHERE RNK = 1
      AND NO_DOC = :doc_no
    ORDER BY NO_DOC
  `;
}

async function findOne(doc: string) {
  const first = await execRows(buildSql(detectKind(doc)), { doc_no: doc }, {}, "DB222");
  if (Array.isArray(first) && first.length) return first[0];

  // fallback khusus BAKAK
  const fb = await execRows(buildSql("BAKAK"), { doc_no: doc }, {}, "DB222");
  if (Array.isArray(fb) && fb.length) return fb[0];

  return {
    NO_DOC: doc,
    NIK: "-",
    NAMA_LGKP: "-",
    JNS_AKTA: "NOMOR AKTA TIDAK DITEMUKAN",
    CERT_STATUS: "NF",
    JML_PENGAJUAN: 0,
    REQ_DATE: "-",
    REQ_BY: "-",
    URL_DOKUMEN: "-",
    URL_KK: "-",
    URL_DATE: "-",
    URL_DOWNLOAD: "-",
    URL_REGISTER: "-",
    APROVE_DATE: "-",
  };
}

/* ===== Handlers ===== */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const list = parseList(url.searchParams.get("noAkte"));
  if (list.length === 0) return ok({ items: [], count: 0 });

  try {
    const items = [];
    for (const doc of list) items.push(await findOne(doc));
    return ok({ items, count: items.length });
  } catch (e: any) {
    const m = String(e?.message || "");
    if (m.includes("ORA-")) return badRequest("Query Akta gagal dieksekusi. Cek parameter atau hak akses DB.");
    return err(m || "Gagal memuat status Akta", 500);
  }
}

// gunakan POST untuk input panjang (disarankan)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const list = Array.isArray(body?.list)
      ? parseList((body.list as string[]).join(","))
      : parseList(body?.noAkte);

    if (list.length === 0) return ok({ items: [], count: 0 });

    const items = [];
    for (const doc of list) items.push(await findOne(doc));
    return ok({ items, count: items.length });
  } catch (e: any) {
    const m = String(e?.message || "");
    if (m.includes("ORA-")) return badRequest("Query Akta gagal dieksekusi. Cek parameter atau hak akses DB.");
    return err(m || "Gagal memuat status Akta", 500);
  }
}
