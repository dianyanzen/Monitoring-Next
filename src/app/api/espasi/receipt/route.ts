// FILE: src/app/api/espasi/receipt/route.ts

import type { NextRequest } from "next/server";
import { chromium } from "playwright";
import CryptoJS from "crypto-js";
import { promises as fs } from "fs";
import path from "path";

import { badRequest, err, unauthorized } from "@/lib/http";
import { execOne } from "@/lib/db";
import {
  getClientInfo,
  readServerSession,
} from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AT = "/api/espasi/receipt";

/*
 * Gunakan alias database yang sama dengan API Tracking Pengajuan.
 * Jangan membuat / mengubah ENV di route ini.
 */
const ORACLE_ALIAS =
  process.env.DB_ALIAS_TRACKING ?? "DB";

/*
 * ASSET LOGO / WATERMARK
 * ============================================================
 * Di page.tsx (client), <img src="/assets/..."> berhasil karena
 * itu path publik yang di-resolve browser relatif ke window.location.
 * Playwright yang merender page.setContent(html) di server TIDAK
 * punya origin browser seperti itu, jadi path relatif ATAU URL yang
 * bergantung pada network tidak bisa diandalkan.
 *
 * Solusi paling langsung & tidak butuh env baru: baca file yang sama
 * persis dari folder public di disk, lalu di-embed sebagai base64
 * data URI. Playwright tidak perlu fetch kemana pun.
 *
 * Path ini mengikuti struktur Next.js: public/assets/plugins/images/receipt/*
 */
const PUBLIC_DIR = path.join(process.cwd(), "public");
const HEADER_LOGO_PATH = path.join(
  PUBLIC_DIR,
  "assets/plugins/images/receipt/header-resi.png"
);
const WATERMARK_LOGO_PATH = path.join(
  PUBLIC_DIR,
  "assets/plugins/images/receipt/watermark-resi.png"
);

let cachedHeaderLogoDataUri: string | null = null;
let cachedWatermarkDataUri: string | null = null;

async function fileToDataUri(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function getHeaderLogoDataUri(): Promise<string> {
  if (cachedHeaderLogoDataUri) return cachedHeaderLogoDataUri;
  cachedHeaderLogoDataUri = await fileToDataUri(HEADER_LOGO_PATH);
  return cachedHeaderLogoDataUri;
}

async function getWatermarkDataUri(): Promise<string> {
  if (cachedWatermarkDataUri) return cachedWatermarkDataUri;
  cachedWatermarkDataUri = await fileToDataUri(WATERMARK_LOGO_PATH);
  return cachedWatermarkDataUri;
}

/* ============================================================
 * KONSTANTA - disalin persis dari page.tsx (tracking-pengajuan/page.tsx)
 * ============================================================ */

const QR_SECRET = "DISDUKCAPIL-BANDUNG-2026-QR-SECRET";

const RECEIPT_HEADER = {
  city: "PEMERINTAH KOTA BANDUNG",
  office: "DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL",
  address: "Jalan Ambon Nomor 1B Kota Bandung, Jawa Barat 40115",
  phoneFax: "Telepon (022) 0224209891, Fax. (022) 4209891",
  websiteLabel: "https://disdukcapil.bandung.go.id/",
  websiteHref: "https://disdukcapil.bandung.go.id/",
  emailLabel: "disdukcapilkotabdg@gmail.com",
  emailHref: "mailto:disdukcapilkotabdg@gmail.com",
} as const;

const BBL_EXTRA_NOTE = "BBL";
const DEFAULT_BABY_NIK = "327300000000000";
const RESI_CONTACT_ONLY_PRODUCT_CODES = new Set(["KAS", "PCS", "LEG"]);
const RESI_CONTACT_ONLY_NOTE_HTML =
  '<li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>';

/* Ikon SVG - hanya yang dipakai template non-legacy di page.tsx */
const ICONS = {
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-5.5 7-12a7 7 0 10-14 0c0 6.5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4h6v3H9z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 013 5.2 2 2 0 015 3h3a2 2 0 012 1.7l.4 2.6a2 2 0 01-.6 1.8l-1.6 1.6a16 16 0 007 7l1.6-1.6a2 2 0 011.8-.6l2.6.4A2 2 0 0122 16.9z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`,
} as const;

/* ============================================================
 * TYPE
 * ============================================================
 *
 * CATATAN PENTING soal kolom NO_KEC / NO_KEL:
 * Di page.tsx, row.kecamatan & row.kelurahan sudah berupa NAMA
 * wilayah (mis. "REGOL", "PASIRLUYU"), bukan kode. Di query lama
 * API ini, NO_KEC / NO_KEL diambil apa adanya dari M_TRACKING_REQUEST
 * yang kemungkinan besar berisi KODE, bukan nama.
 *
 * Supaya benar-benar identik dengan resi di halaman, kolom ini
 * perlu di-JOIN ke master wilayah (kecamatan/kelurahan) untuk
 * mendapatkan nama, sama seperti API /api/tracking-pengajuan.
 * Karena skema tabel wilayah tidak ada di route ini, saya tandai
 * dengan alias KECAMATAN_NAME / KELURAHAN_NAME di bawah - SILAKAN
 * SESUAIKAN JOIN-nya dengan tabel master wilayah yang sebenarnya
 * dipakai di endpoint /api/check/ktpel/meta atau /kelurahan.
 */

type ReceiptRow = {
  REQUEST_ID: number;
  REGISTRATION_NO: string | null;
  QUEUE_NO: string | null;
  NO_DOK: string | null;

  LOCATION_ID: number | null;
  LOCATION_CODE: string | null;
  LOCATION_NAME: string | null;
  LOCATION_GROUP: string | null;

  PRODUCT_ID: number | null;
  PRODUCT_CODE: string | null;
  PRODUCT_NAME: string | null;

  NIK: string | null;
  APPLICANT_NAME: string | null;

  NO_KEC: string | null;
  NO_KEL: string | null;
  KECAMATAN_NAME: string | null;
  KELURAHAN_NAME: string | null;

  ALAMAT: string | null;
  NO_RW: number | null;
  NO_RT: number | null;

  PHONE: string | null;
  EMAIL: string | null;

  STATUS: string | null;
  SOURCE: string | null;
  NOTES: string | null;
  EXTRA_NOTE: string | null;

  CREATED_BY: string | null;
  CREATED_DATE: string | null;
  CREATED_TIME: string | null;
};

/* ============================================================
 * HELPERS - umum
 * ============================================================ */

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function safe(value: unknown): string {
  return text(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dash(value: unknown): string {
  const valueText = text(value);
  return valueText || "-";
}

/* Format RT/RW persis seperti page.tsx: String(value ?? 0).padStart(3, "0") */
function pad3(value: unknown): string {
  const raw = text(value);
  const num = Number(raw);
  if (!raw || Number.isNaN(num)) return "000";
  return String(num).padStart(3, "0");
}

function statusLabel(value: unknown): string {
  const raw = text(value).toUpperCase();

  switch (raw) {
    case "BERKAS_MASUK":
      return "BERKAS MASUK";
    case "VERIFIKASI":
      return "VERIFIKASI";
    case "DIPROSES":
      return "DIPROSES";
    case "SELESAI":
      return "SELESAI";
    case "DITOLAK":
      return "DITOLAK";
    case "BATAL":
      return "BATAL";
    default:
      return raw || "BERKAS MASUK";
  }
}

function hasBblFlag(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toUpperCase().includes(BBL_EXTRA_NOTE);
}

/* Disalin persis dari page.tsx */
function normalizeGeulisName(value: string): string {
  const raw = String(value || "").trim().toUpperCase();
  const compact = raw.replace(/\s+/g, " ");
  if (compact.includes("BTC") || compact.includes("DBOTANICA") || compact.includes("D BOTANICA") || compact.includes("D'BOTANICA")) return "GEULIS D'BOTANICA";
  if (compact.includes("DPRD")) return "GEULIS DPRD";
  if (compact.includes("MIM")) return "GEULIS MIM";
  if (compact.includes("SUMARECON") || compact.includes("SUMMARECON")) return "GEULIS SUMARECON";
  if (compact.includes("KIWARI")) return "GEULIS KIWARI";
  if (compact.includes("MPP")) return "GEULIS MPP";
  const withoutPrefix = compact.replace(/^GEULIS\s+/, "").trim();
  return withoutPrefix ? `GEULIS ${withoutPrefix}` : "GEULIS";
}

/* Disalin persis dari page.tsx (getLocationLabel) */
function getLocationLabel(row: ReceiptRow): string {
  const locationId = Number(row.LOCATION_ID ?? 0);
  const locationName = text(row.LOCATION_NAME);
  const locationCode = text(row.LOCATION_CODE);

  if (locationId >= 1 && locationId <= 30) {
    return `KECAMATAN ${locationName}`;
  }
  if (locationId >= 31 && locationId <= 36) {
    return normalizeGeulisName(locationName);
  }
  if (locationCode === "99" || locationName.toUpperCase() === "DINAS") {
    return "DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL KOTA BANDUNG";
  }
  return locationName;
}

/* Disalin persis dari page.tsx (formatProductHeading) */
function formatProductHeading(productName: string): string {
  const normalized = productName?.trim()?.toUpperCase() || "";
  if (normalized.includes("KARTU IDENTITAS ANAK")) {
    return "KARTU IDENTITAS ANAK (KIA)";
  }
  return productName;
}

/* ============================================================
 * QR - AES terenkripsi, identik dengan page.tsx (encryptResi / qrUrl)
 * ============================================================ */

function encryptResi(resi: string): string {
  const key = CryptoJS.SHA256(QR_SECRET);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(resi, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const combined = iv.clone().concat(encrypted.ciphertext);
  return encodeURIComponent(CryptoJS.enc.Base64.stringify(combined));
}

function qrUrl(registrationNo: string): string {
  const encryptedResi = encryptResi(registrationNo);
  const targetUrl = `https://disdukcapil.bandung.go.id/api/web/cekresi?r=${encryptedResi}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=132x132&data=${encodeURIComponent(targetUrl)}`;
}

/* ============================================================
 * CATATAN (notes) - logic per jenis layanan, disalin persis dari
 * blok <ul> di printReceipt() (bukan versi legacy dinas).
 * ============================================================ */

function buildNotesHtml(params: {
  isContactOnlyService: boolean;
  isKiaService: boolean;
  isKtpelOrIkdService: boolean;
  isBbl: boolean;
  isDinasLocation: boolean;
  isGeraiLocation: boolean;
  isKematian: boolean;
  isPindahKeluar: boolean;
  locationName: string;
}): string {
  const {
    isContactOnlyService,
    isKiaService,
    isKtpelOrIkdService,
    isBbl,
    isDinasLocation,
    isGeraiLocation,
    isKematian,
    isPindahKeluar,
    locationName,
  } = params;

  if (isContactOnlyService) {
    return RESI_CONTACT_ONLY_NOTE_HTML;
  }

  if (isKiaService) {
    return [
      '<li>Jika Anda sudah menerima email <strong>SIAK Online</strong> dari <strong>Ditjen Dukcapil Kemendagri</strong>, silakan <strong>pindai atau klik QR Code yang terdapat pada email tersebut</strong> untuk mengakses dokumen KIA.</li>',
      '<li>Untuk pencetakan KIA, masyarakat dapat <strong>memilih cara yang paling sesuai dan mudah</strong>, baik dengan mencetak secara mandiri melalui <strong>Anjungan Dukcapil Mandiri (ADM)</strong> terdekat, mencetak melalui <strong>Gerai Geulis</strong> terdekat, maupun mengambil KIA melalui <strong>Loket Pengambilan Disdukcapil</strong> dengan membawa <strong>resi asli</strong> ini.</li>',
      '<li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>',
    ].join("");
  }

  if (isKtpelOrIkdService) {
    return [
      `<li><strong>Cek Status Pencetakan KTP-el:</strong> Klik <strong><a href="${RECEIPT_HEADER.websiteHref}" target="_blank" rel="noreferrer">${RECEIPT_HEADER.websiteLabel}</a></strong> lalu pilih <strong>Pencetakan KTP-el</strong>.</li>`,
      '<li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>',
    ].join("");
  }

  const items: string[] = [
    '<li>Jika Anda sudah menerima email <strong>SIAK Online</strong> dari <strong>Ditjen Dukcapil Kemendagri</strong>, silakan <strong>pindai atau klik QR CODE</strong> yang terdapat pada email tersebut untuk mengakses dokumen.</li>',
    '<li>Dokumen dapat <strong>dicetak secara mandiri</strong> menggunakan kertas <strong>HVS ukuran A4 80 gram</strong>.</li>',
  ];

  if (isBbl) {
    items.push(
      '<li>Untuk keperluan pendaftaran atau pelayanan <strong>BPJS Kesehatan</strong> bagi bayi baru lahir, resi ini dapat ditunjukkan sebagai dokumen pendukung.</li>'
    );
  }
  if (isDinasLocation) {
    items.push(
      '<li>Jika hingga <strong>jangka waktu penyelesaian</strong> berakhir Anda belum menerima <strong>email SIAK Online dari Ditjen Dukcapil Kemendagri</strong>, silakan mendatangi <strong>Loket Pengambilan Disdukcapil</strong> dengan membawa <strong>resi asli</strong> ini.</li>'
    );
  }
  if (isGeraiLocation && isKematian) {
    items.push(
      `<li>Apabila terdapat kekeliruan pada <strong>Penerbitan Kutipan Akta Kematian</strong> dan email belum diterima dalam <strong>jangka waktu penyelesaian</strong>, mohon segera melapor ke <strong>${safe(locationName)}</strong>.</li>`
    );
  }
  if (isPindahKeluar) {
    items.push(
      '<li>Khusus permohonan <strong>Surat Pindah/SKPWNI</strong>, dokumen berlaku selama <strong>60 (enam puluh) hari sejak tanggal diterbitkan</strong>.</li>'
    );
  }
  items.push(
    '<li>Untuk memperoleh informasi lebih lanjut atau menyampaikan pengaduan, silakan menghubungi <strong>Call Center 0852-0888-1945</strong>.</li>'
  );

  return items.join("");
}

/* ============================================================
 * DATABASE
 * ============================================================
 *
 * Browser hanya mengirim registrationNo.
 * Seluruh isi resi dibaca ulang dari Oracle.
 *
 * NOTE: T.NO_DOK ditambahkan agar field "No. Dokumen" bisa identik
 * dengan page.tsx (form.noDok). Sesuaikan nama kolom bila berbeda.
 */

const SQL_RECEIPT = `
SELECT
    T.REQUEST_ID,
    T.REGISTRATION_NO,
    T.QUEUE_NO,
    T.NO_DOK,

    T.LOCATION_ID,
    L.LOCATION_CODE,
    L.LOCATION_NAME,
    L.LOCATION_GROUP,

    T.PRODUCT_ID,
    P.PRODUCT_CODE,
    P.PRODUCT_NAME,

    T.NIK,
    T.APPLICANT_NAME,

    T.NO_KEC,
    T.NO_KEL,
    T.NO_KEC AS KECAMATAN_NAME,
    T.NO_KEL AS KELURAHAN_NAME,

    T.ALAMAT,
    T.NO_RW,
    T.NO_RT,

    T.PHONE,
    T.EMAIL,

    T.STATUS,
    T.SOURCE,
    T.NOTES,
    T.EXTRA_NOTE,

    T.CREATED_BY,

    TO_CHAR(
      T.CREATED_AT,
      'DD-MM-YYYY'
    ) AS CREATED_DATE,

    TO_CHAR(
      T.CREATED_AT,
      'HH24:MI'
    ) AS CREATED_TIME

FROM M_TRACKING_REQUEST T

LEFT JOIN M_TRACKING_LOCATION L
  ON L.LOCATION_ID = T.LOCATION_ID

LEFT JOIN M_TRACKING_PRODUCT P
  ON P.PRODUCT_ID = T.PRODUCT_ID

WHERE UPPER(T.REGISTRATION_NO) =
      UPPER(:b_registration_no)

  AND T.IS_ACTIVE = 'Y'

FETCH FIRST 1 ROW ONLY
`;

/* ============================================================
 * HTML RECEIPT - identik dengan printReceipt() di page.tsx
 * (versi non-legacy, karena useLegacyDinasReceipt selalu false)
 * ============================================================ */

async function buildReceiptHtml(row: ReceiptRow): Promise<string> {
  const [headerLogoDataUri, watermarkDataUri] = await Promise.all([
    getHeaderLogoDataUri(),
    getWatermarkDataUri(),
  ]);

  const registrationNo = dash(row.REGISTRATION_NO);
  const nik = dash(row.NIK);
  const name = dash(row.APPLICANT_NAME);
  const noDokInput = text(row.NO_DOK);

  const productNameRaw = text(row.PRODUCT_NAME);
  const productName = productNameRaw.toUpperCase();
  const productHeading = safe(formatProductHeading(row.PRODUCT_NAME || ""));

  const isBbl = hasBblFlag(row.EXTRA_NOTE);
  const isKelahiran = productName.includes("KELAHIRAN");
  const isKematian = productName.includes("KEMATIAN");
  const nikRaw = text(row.NIK);
  const hideNikOnReceipt =
    !isBbl && (isKelahiran || isKematian) && (!nikRaw || nikRaw === DEFAULT_BABY_NIK);

  const locationId = Number(row.LOCATION_ID ?? 0);
  const locationCode = text(row.LOCATION_CODE);
  const locationNameRaw = text(row.LOCATION_NAME);
  const isDinasLocation = locationCode === "99" || locationNameRaw.toUpperCase() === "DINAS";
  const isGeraiLocation = locationId >= 31 && locationId <= 36;
  const locationLabel = safe(getLocationLabel(row));

  const nikDisplayLabel = isKelahiran ? "NIK Bayi" : isKematian ? "NIK Almarhum" : "NIK Pemohon";
  const namaDisplayLabel = isKelahiran ? "Nama Bayi" : isKematian ? "Nama Almarhum" : "Nama Pemohon";

  const isPindahKeluar = ["PINDAH KELUAR", "SURAT PINDAH", "SKPWNI"].some((keyword) =>
    productName.includes(keyword)
  );

  const productCode = text(row.PRODUCT_CODE).toUpperCase();
  const isContactOnlyService = RESI_CONTACT_ONLY_PRODUCT_CODES.has(productCode);

  const isKtpelOrIkdService = [
    "KTP-EL",
    "KTP EL",
    "KTPEL",
    "KTP ELEKTRONIK",
    "PEREKAMAN KTP",
    "PENCETAKAN KTP",
    "IKD",
    "IDENTITAS KEPENDUDUKAN DIGITAL",
  ].some((keyword) => productName.includes(keyword));

  const isKiaService = ["KIA", "KARTU IDENTITAS ANAK"].some((keyword) =>
    productName.includes(keyword)
  );

  const alamat = safe(dash(row.ALAMAT));
  const rt = pad3(row.NO_RT);
  const rw = pad3(row.NO_RW);
  const rtRw = `${rt}/${rw}`;
  // NOTE: lihat komentar pada type ReceiptRow - ganti ke nama wilayah hasil JOIN
  const kelurahan = safe(dash(row.KELURAHAN_NAME ?? row.NO_KEL));
  const kecamatan = safe(dash(row.KECAMATAN_NAME ?? row.NO_KEC));

  const phone = safe(dash(row.PHONE));
  const email = safe(dash(row.EMAIL));

  const createdDate = dash(row.CREATED_DATE);
  const createdTime = dash(row.CREATED_TIME);

  const statusLabelText = safe(statusLabel(row.STATUS));

  const qrImgUrl = qrUrl(text(row.REGISTRATION_NO));

  const notesListHtml = buildNotesHtml({
    isContactOnlyService,
    isKiaService,
    isKtpelOrIkdService,
    isBbl,
    isDinasLocation,
    isGeraiLocation,
    isKematian,
    isPindahKeluar,
    locationName: locationNameRaw,
  });

  const receiptSection = (copyLabel: string): string => {
    const isMasyarakatCopy = copyLabel === "UNTUK MASYARAKAT";

    return `
      <div class="receipt">
        <div class="watermark"><img src="${watermarkDataUri}" alt="Watermark" /></div>
        <div class="copy-tag">${safe(copyLabel)}</div>
        <div class="wrap">
          <div class="head">
            <img class="header-logo" src="${headerLogoDataUri}" alt="Header Resi" />
            <div class="header-text">
              <div class="small">${RECEIPT_HEADER.city}</div>
              <div class="big">${RECEIPT_HEADER.office}</div>
              <div class="meta">${RECEIPT_HEADER.address}</div>
              <div class="meta">${RECEIPT_HEADER.phoneFax}</div>
              <div class="meta meta-link">Laman : <a href="${RECEIPT_HEADER.websiteHref}" target="_blank" rel="noreferrer">${RECEIPT_HEADER.websiteLabel}</a>, Pos-el : <a href="${RECEIPT_HEADER.emailHref}">${RECEIPT_HEADER.emailLabel}</a></div>
            </div>
            <div class="head-spacer" aria-hidden="true"></div>
          </div>
          <div class="rule"></div>
          <div class="title-block">
            <div class="main">BUKTI REGISTRASI PENGAJUAN</div>
            <div class="sub">LAYANAN ADMINISTRASI KEPENDUDUKAN</div>
          </div>
          <div class="register-focus">
            <div class="register-focus-label">NOMOR REGISTRASI</div>
            <div class="register-focus-value">${safe(registrationNo)}</div>
          </div>
          <div class="rule"></div>
          <div class="content-grid">
            <div class="left-col">
              <div class="section">
                <div class="section-title">${ICONS.user}<span>1. IDENTITAS PENDUDUK</span></div>
                <table class="info-table">
                  <tbody>
                    ${
                      isMasyarakatCopy
                        ? `${isBbl && !hideNikOnReceipt ? `<tr><td class="label">${nikDisplayLabel}</td><td class="value">: ${safe(nik)}</td></tr>` : ""}<tr><td class="label">${namaDisplayLabel}</td><td class="value">: ${safe(name)}</td></tr>`
                        : `
                    ${hideNikOnReceipt ? "" : `<tr><td class="label">${nikDisplayLabel}</td><td class="value">: ${safe(nik)}</td></tr>`}
                    <tr><td class="label">${namaDisplayLabel}</td><td class="value">: ${safe(name)}</td></tr>
                    <tr><td class="label icon-label">${ICONS.phone}<span>Nomor HP</span></td><td class="value">: ${phone}</td></tr>
                    <tr><td class="label icon-label">${ICONS.mail}<span>Email</span></td><td class="value">: ${email}</td></tr>`
                    }
                  </tbody>
                </table>
              </div>
              ${
                isMasyarakatCopy
                  ? ""
                  : `<div class="section">
                <div class="section-title">${ICONS.map}<span>2. ALAMAT</span></div>
                <table class="info-table">
                  <tbody>
                    <tr><td class="label">Alamat</td><td class="value">: ${alamat}</td></tr>
                    <tr><td class="label">RT / RW</td><td class="value">: ${rtRw}</td></tr>
                    <tr><td class="label">Kelurahan</td><td class="value">: ${kelurahan}</td></tr>
                    <tr><td class="label">Kecamatan</td><td class="value">: ${kecamatan}</td></tr>
                  </tbody>
                </table>
              </div>`
              }
              <div class="section">
                <div class="section-title">${ICONS.clipboard}<span>${isMasyarakatCopy ? "2" : "3"}. DETAIL PENGAJUAN</span></div>
                <table class="info-table">
                  <tbody>
                    <tr><td class="label">Jenis Layanan</td><td class="value">: ${productHeading}</td></tr>
                    <tr><td class="label">Lokasi Layanan</td><td class="value">: ${locationLabel}</td></tr>
                    ${noDokInput ? `<tr><td class="label">No. Dokumen</td><td class="value">: ${safe(noDokInput)}</td></tr>` : ""}
                    <tr><td class="label icon-label">${ICONS.calendar}<span>Tanggal</span></td><td class="value">: ${safe(createdDate)}</td></tr>
                    <tr><td class="label icon-label">${ICONS.clock}<span>Jam</span></td><td class="value">: ${safe(createdTime)} WIB</td></tr>
                    <tr><td class="label">Status</td><td class="value"><span class="status">${statusLabelText}</span></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="right-col">
              <div class="qr-box">
                <div class="qr-title">${ICONS.shield}<span>4. VERIFIKASI</span></div>
                <img src="${qrImgUrl}" alt="QR Code" />
                <div class="qr-note">Pindai QR Code atau kunjungi disdukcapil.bandung.go.id dan masukkan Nomor Registrasi.</div>
              </div>
              <div class="doc-meta">
                <table class="meta-table">
                  <tbody>
                    <tr><td class="meta-label">Dokumen</td><td class="meta-value">: Bukti Registrasi</td></tr>
                    <tr><td class="meta-label">No.</td><td class="meta-value">: ${safe(registrationNo)}</td></tr>
                    <tr><td class="meta-label">Tanggal Cetak</td><td class="meta-value">: ${safe(createdDate)} ${safe(createdTime)} WIB</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div class="rule"></div>
          <div class="notes">
            <div class="notes-title">CATATAN</div>
            <ul>
              ${notesListHtml}
            </ul>
          </div>
          <div class="rule"></div>
          <div class="footer">
            <span class="footer-shield">${ICONS.shield}</span>
            <span>Dokumen ini merupakan bukti registrasi pengajuan layanan administrasi kependudukan melalui Sistem MONALISA. Gunakan QR Code atau Nomor Registrasi untuk memantau status pengajuan.</span>
            <span>Kontak: disdukcapilkotabdg@gmail.com</span>
          </div>
        </div>
      </div>
    `;
  };

  /*
   * SATU-SATUNYA TEMPLATE HTML UTAMA.
   * CSS di bawah ini disalin persis dari <style> pada printReceipt()
   * di page.tsx (bagian non-legacy).
   */
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Bukti Registrasi Pengajuan ${safe(registrationNo)}</title>
  <style>
    /* ========================================================
     * PRINT LAYOUT — Chrome 109 SAFE
     * A4 = 210 x 297 mm
     * Sheet = 200 x 283 mm
     * Visual margin = 5 mm kiri/kanan + safety bottom 9 mm
     * Tidak memakai CSS Grid pada sheet agar Chromium lama
     * tidak melakukan fractional rounding yang memicu page 2.
     * ======================================================== */
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html{width:210mm;min-height:297mm;margin:0;padding:0;background:#fff}
    body{font-family:Arial,sans-serif;width:210mm;min-height:297mm;margin:0;padding:0;background:#fff;color:#111;overflow:hidden}
    @page{size:A4 portrait;margin:0}

    .sheet{
      box-sizing:border-box;
      width:200mm;
      height:283mm;
      margin:5mm auto 9mm auto;
      padding:0;
      display:block;
      overflow:hidden;
      position:relative;
      break-before:avoid;
      break-after:avoid;
      break-inside:avoid;
      page-break-before:avoid;
      page-break-after:avoid;
      page-break-inside:avoid;
    }

    .receipt{
      box-sizing:border-box;
      width:200mm;
      height:141mm;
      padding:4mm 4.5mm;
      margin:0;
      break-before:avoid;
      break-after:avoid;
      break-inside:avoid;
      page-break-before:avoid;
      page-break-after:avoid;
      page-break-inside:avoid;
      overflow:hidden;
      position:relative;
    }

    .cut-line{
      box-sizing:border-box;
      width:200mm;
      height:1mm;
      margin:0;
      padding:0;
      border-top:1px dashed #777;
      border-bottom:0;
      break-before:avoid;
      break-after:avoid;
      break-inside:avoid;
      page-break-before:avoid;
      page-break-after:avoid;
      page-break-inside:avoid;
    }
    .watermark{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;user-select:none}
    .watermark img{width:690px;height:690px;object-fit:contain;opacity:.12;filter:grayscale(1) contrast(1.05)}
    .copy-tag{position:absolute;top:4mm;right:4.5mm;background:#000;color:#fff;padding:1px 8px;font-size:8.6px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
    .wrap{width:100%;margin:0 auto;display:grid;gap:4px;position:relative;z-index:1}
    .rule{height:1px;background:#000}
    .head{display:grid;grid-template-columns:68px 1fr 68px;gap:6px;align-items:center}
    .header-logo{width:68px;height:44px;object-fit:contain}
    .header-text{display:flex;flex-direction:column;gap:1px;align-items:center;text-align:center}
    .header-text .small{font-size:8.6px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
    .header-text .big{font-size:11.4px;font-weight:800;text-transform:uppercase;line-height:1.05;text-align:center}
    .header-text .meta{font-size:7.6px;font-weight:600;color:#222;line-height:1.2;text-align:center}
    .header-text .meta-link a{color:inherit;text-decoration:underline}
    .head-spacer{width:68px;height:44px}
    .title-block{display:grid;gap:2px;text-align:center;margin-top:2px}
    .title-block .main{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.03em}
    .title-block .sub{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
    .register-focus{border-top:1px solid #000;border-bottom:1px solid #000;padding:2px 6px;text-align:center}
    .register-focus-label{font-size:8.6px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .register-focus-value{font-size:13px;font-weight:900;letter-spacing:.01em;line-height:1.1;margin-top:1px;word-break:break-word}
    .content-grid{display:grid;grid-template-columns:68% 32%;gap:8px;align-items:start}
    .left-col{display:grid;gap:3px}
    .section{display:grid;gap:2px}
    .section-title{display:flex;align-items:center;gap:5px;font-size:9.6px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #000;border-bottom:1px solid #000;padding:1px 0}
    .section-title svg{width:13px;height:13px;flex:none}
    .info-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .info-table td{padding:.5px 0;font-size:9.2px;vertical-align:top;line-height:1.15}
    .info-table .label{width:104px;font-weight:600;white-space:nowrap;padding-right:6px}
    .info-table .label.icon-label{display:flex;align-items:center;gap:3px}
    .info-table .label.icon-label svg{width:11px;height:11px;flex:none}
    .info-table .value{font-weight:500;word-break:break-word}
    .right-col{display:grid;gap:4px}
    .qr-box{border:1px solid #000;padding:4px;display:grid;justify-items:center;gap:3px}
    .qr-box .qr-title{display:flex;align-items:center;gap:4px;font-size:8.8px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    .qr-box .qr-title svg{width:12px;height:12px;flex:none}
    .qr-box img{width:112px;height:112px;display:block}
    .qr-note{font-size:7.8px;line-height:1.2;text-align:center;font-weight:500;color:#333}
    .doc-meta{border:1px dashed #8a8a8a;padding:4px}
    .meta-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .meta-table td{font-size:8.6px;line-height:1.15;vertical-align:top;padding:.5px 0}
    .meta-label{width:72px;font-weight:600;white-space:nowrap}
    .meta-value{font-weight:500;word-break:break-word}
    .status{display:inline-block;padding:1px 8px;border:1.2px solid #000;font-weight:800;text-transform:uppercase;font-size:8.6px;letter-spacing:.03em}
    .footer{font-size:8.3px;line-height:1.2;color:#333;text-align:center;display:grid;gap:1px;justify-items:center;padding-top:1px}
    .footer-shield svg{width:12px;height:12px}
    .footer strong{font-weight:800}
    .notes{border:1px solid #000;border-radius:2px;padding:3px 4px;display:grid;gap:2px}
    .notes-title{font-size:8.4px;font-weight:900;letter-spacing:.03em;text-transform:uppercase}
    .notes ul{margin:0;padding-left:12px;display:grid;gap:1px}
    .notes li{font-size:7.2px;line-height:1.2;color:#222}
    .notes strong{font-weight:800}
    /* Elemen internal tidak boleh menjadi titik page-break. */
    .wrap,.content-grid,.left-col,.right-col,.section,.info-table,.notes,.footer{
      break-inside:avoid;
      page-break-inside:avoid;
    }

    img{display:block}

    @media print{
      html,body{
        width:210mm !important;
        min-height:297mm !important;
        margin:0 !important;
        padding:0 !important;
        overflow:hidden !important;
      }

      .noprint{display:none !important}

      .sheet{
        width:200mm !important;
        height:283mm !important;
        margin:5mm auto 9mm auto !important;
        padding:0 !important;
        overflow:hidden !important;
        display:block !important;
        break-before:avoid !important;
        break-after:avoid !important;
        break-inside:avoid !important;
        page-break-before:avoid !important;
        page-break-after:avoid !important;
        page-break-inside:avoid !important;
      }

      .receipt{
        width:200mm !important;
        height:141mm !important;
        margin:0 !important;
        overflow:hidden !important;
        break-before:avoid !important;
        break-after:avoid !important;
        break-inside:avoid !important;
        page-break-before:avoid !important;
        page-break-after:avoid !important;
        page-break-inside:avoid !important;
      }

      .cut-line{
        width:200mm !important;
        height:1mm !important;
        margin:0 !important;
        padding:0 !important;
        break-before:avoid !important;
        break-after:avoid !important;
        break-inside:avoid !important;
        page-break-before:avoid !important;
        page-break-after:avoid !important;
        page-break-inside:avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    ${receiptSection("UNTUK MASYARAKAT")}
    <div class="cut-line"></div>
    ${receiptSection("UNTUK DI BERKAS")}
  </div>
</body>
</html>
`;

  return html;
}

/* ============================================================
 * PDF
 * ============================================================ */

async function htmlToPdf(html: string): Promise<ArrayBuffer> {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--disable-gpu",
      "--no-sandbox",
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: {
        width: 794,
        height: 1123,
      },
      deviceScaleFactor: 1,
    });

    await page.emulateMedia({ media: "print" });

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    /* Tunggu font sebelum layout final dihitung. */
    await page.evaluate(async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // lanjutkan; receipt tetap bisa dibuat tanpa Font Loading API
      }
    });

    /*
     * Tunggu gambar (logo header, watermark, QR code).
     * Jika salah satu gagal dimuat, PDF tetap dibuat.
     */
    await page.evaluate(async () => {
      const images = Array.from(document.images);

      await Promise.all(
        images.map((image) => {
          if (image.complete) {
            return Promise.resolve();
          }

          return new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        })
      );
    });

    /*
     * Tunggu dua frame agar image + layout benar-benar settle.
     * Ini penting untuk Chromium lama karena layout print dapat
     * melakukan reflow sesaat setelah image selesai dimuat.
     */
    await page.evaluate(() =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      })
    );

    /* Force layout calculation sebelum page.pdf(). */
    await page.evaluate(() => {
      const sheet = document.querySelector(".sheet") as HTMLElement | null;
      if (!sheet) return;
      void sheet.offsetHeight;
      void sheet.scrollHeight;
      void sheet.clientHeight;
    });

    const pdf = await page.pdf({
		  format: "A4",
		  landscape: false,
		  printBackground: true,
		  preferCSSPageSize: false,

		  margin: {
			top: "0mm",
			right: "0mm",
			bottom: "0mm",
			left: "0mm",
		  },

		  displayHeaderFooter: false,

		  // FORCE PDF HANYA HALAMAN 1
		  pageRanges: "1",

		  scale: 1,
		});

    return pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer;
  } finally {
    await browser.close();
  }
}

/* ============================================================
 * GET
 * ============================================================ */

export async function GET(req: NextRequest) {
  const started = Date.now();

  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();

    if (!session?.S_USER_ID) {
      return unauthorized("Unauthorized");
    }

    /*
     * ESPASI mengirim:
     * /api/espasi/receipt?registrationNo=REG-00-...
     * Bukan trackingId.
     */
    const registrationNo = text(
      req.nextUrl.searchParams.get("registrationNo")
    );

    if (!registrationNo) {
      return badRequest("registrationNo wajib diisi.");
    }

    if (registrationNo.length > 100) {
      return badRequest("registrationNo tidak valid.");
    }

    /*
     * DB = source of truth.
     * Browser tidak boleh menentukan isi PDF.
     */
    const row = await execOne<ReceiptRow>(
      SQL_RECEIPT,
      {
        b_registration_no: registrationNo,
      },
      {},
      ORACLE_ALIAS
    );

    if (!row) {
      await Log.warn({
        scope: "API",
        msg: "ESPASI receipt not found",
        at: AT,
        user: session.S_USER_ID,
        ip,
        ua,
        tookMs: Date.now() - started,
        extra: {
          registrationNo,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Data pengajuan dengan nomor registrasi tersebut tidak ditemukan.",
          data: {},
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (!text(row.REGISTRATION_NO)) {
      return err("Nomor registrasi tidak tersedia pada data pengajuan.");
    }

    const html = await buildReceiptHtml(row);

    const pdf = await htmlToPdf(html);

    const safeFileName = text(row.REGISTRATION_NO).replace(/[^A-Za-z0-9_-]/g, "_");

    await Log.info({
      scope: "API",
      msg: "ESPASI receipt PDF",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: {
        requestId: row.REQUEST_ID,
        registrationNo: row.REGISTRATION_NO,
        productCode: row.PRODUCT_CODE,
        locationCode: row.LOCATION_CODE,
      },
    });

    return new Response(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Resi-${safeFileName}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause: unknown) {
    const error = cause instanceof Error ? cause : new Error(String(cause));

    await Log.error({
      scope: "API",
      msg: "ESPASI receipt PDF failed",
      at: AT,
      ip,
      ua,
      tookMs: Date.now() - started,
      err: {
        name: error.name,
        message: error.message,
      },
    });

    return err(error.message || "Gagal membuat PDF resi.");
  }
}
