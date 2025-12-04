// FILE: src/app/api/report/getdaily/pdf2/route.ts
import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, type PDFFont, rgb } from "pdf-lib";
import { badRequest, err, unauthorized } from "@/lib/http";
import { execRows } from "@/lib/db";
import { getClientInfo, readServerSession } from "@/lib/session";
import { Log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORACLE_ALIAS = process.env.DB_ALIAS_MONITORING ?? "DB";
const AT = "/api/report/getdaily/pdf2";
const LETTERHEAD_PATH = path.join(
  process.cwd(),
  "public",
  "assets",
  "plugins",
  "images",
  "pemkotold.png",
);

type Row = {
  TANGGAL: string;
  DESCRIPTION: string;
  JUMLAH: string;
};

const toStr = (v: unknown): string => (v == null ? "" : String(v).trim());

/* =======================================================================
 *  UTIL TANGGAL
 * ======================================================================= */

function normalizeMonthYear(raw: unknown): string | null {
  const value = toStr(raw);
  if (!value) return null;

  // MM-YYYY
  if (/^\d{2}-\d{4}$/.test(value)) return value;

  // YYYY-MM -> MM-YYYY
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [yyyy, mm] = value.split("-");
    return `${mm}-${yyyy}`;
  }
  return null;
}

function prettyMonth(period: string): string {
  const map = [
    "",
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ] as const;

  const [mm, yyyy] = period.split("-");
  const idx = Number(mm);
  const nama = map[idx] || mm;
  return `${nama} ${yyyy}`;
}

/* =======================================================================
 *  CLEANING & WRAP TEXT
 * ======================================================================= */

function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<\/?br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text: string, width: number, font: PDFFont, fontSize: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, fontSize) > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function formatActivities(raw: string): string {
  const cleaned = stripHtml(raw);
  return cleaned.replace(/-\s*/g, "\n- ").replace(/\n{2,}/g, "\n").trim();
}

function formatJumlah(raw: string): string {
  const cleaned = stripHtml(raw);
  return cleaned.replace(/(\d+\s*Aktivitas)/gi, "$1\n").replace(/\n{2,}/g, "\n").trim();
}

/* =======================================================================
 *  LOGO CACHING
 * ======================================================================= */

let cachedLogo: Uint8Array | null = null;

async function loadLogo(): Promise<Uint8Array | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const buf = await fs.readFile(LETTERHEAD_PATH);
    cachedLogo = new Uint8Array(buf);
    return cachedLogo;
  } catch {
    return null;
  }
}

/* =======================================================================
 *  PDF BUILDER
 * ======================================================================= */

async function buildPdf(period: string, rows: Row[], nama: string, nik: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // A4 portrait (point)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;

  const logoBytes = await loadLogo();
  const logoImage = logoBytes ? await pdfDoc.embedPng(logoBytes) : null;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSizeTitle = 15;
  const fontSizeText = 10.5;
  const fontSizeInfo = 11.5;
  const lineHeight = 14;

  const colorBorder = rgb(0.75, 0.8, 0.85);
  const colorHeader = rgb(0.95, 0.96, 0.98);

  // layout tabel
  const colWidths = {
    no: 32,
    tanggal: 82,
    aktivitas: 250,
    jumlah: 105,
    paraf: 50,
  } as const;

  // gridX = batas kiri/kanan tiap kolom (0..5)
  const gridX = [
    margin,
    margin + colWidths.no,
    margin + colWidths.no + colWidths.tanggal,
    margin + colWidths.no + colWidths.tanggal + colWidths.aktivitas,
    margin + colWidths.no + colWidths.tanggal + colWidths.aktivitas + colWidths.jumlah,
    margin +
      colWidths.no +
      colWidths.tanggal +
      colWidths.aktivitas +
      colWidths.jumlah +
      colWidths.paraf,
  ];
  const tableWidth = gridX[gridX.length - 1] - gridX[0];

  const CELL_PADDING_TOP = 6;
  const CELL_PADDING_BOTTOM = 6;
  const CELL_PADDING_LEFT = 6;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawCentered = (
    text: string,
    posY: number,
    size: number,
    font: PDFFont = helveticaBold,
  ) => {
    const w = font.widthOfTextAtSize(text, size);
    const x = (pageWidth - w) / 2;
    page.drawText(text, { x, y: posY, size, font });
  };

  const drawInfoRow = (label: string, value: string) => {
    const labelWidth = 70;
    const colonWidth = 10;

    page.drawText(label, { x: margin, y, size: fontSizeInfo, font: helvetica });
    page.drawText(":", { x: margin + labelWidth, y, size: fontSizeInfo, font: helvetica });
    page.drawText(value || "-", {
      x: margin + labelWidth + colonWidth,
      y,
      size: fontSizeInfo,
      font: helveticaBold,
    });
    y -= 15;
  };

  const drawLetterhead = () => {
    const startY = y;

    // logo kiri
    if (logoImage) {
      const logoHeight = 48;
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      page.drawImage(logoImage, {
        x: margin,
        y: startY - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    }

    let textY = startY - 6;

    // baris 1
    drawCentered("PEMERINTAH KOTA BANDUNG", textY, 13, helveticaBold);
    textY -= 15;

    // baris 2
    drawCentered("DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL", textY, 12, helveticaBold);
    textY -= 13;

    // baris 3
    drawCentered("JL. AMBON NO. 1B KOTA BANDUNG", textY, 11, helvetica);
    textY -= 12;

    // baris 4: JAWA BARAT ... KODE POS : 40115
    const line4a = "JAWA BARAT - ID, ";
    const line4b = "KODE POS : 40115";
    const size4 = 11;

    const w4a = helvetica.widthOfTextAtSize(line4a, size4);
    const w4b = helveticaBold.widthOfTextAtSize(line4b, size4);
    const total4 = w4a + w4b;
    let x4 = (pageWidth - total4) / 2;

    page.drawText(line4a, { x: x4, y: textY, size: size4, font: helvetica });
    page.drawText(line4b, { x: x4 + w4a, y: textY, size: size4, font: helveticaBold });
    textY -= 12;

    // baris 5: telp/fax/email
    drawCentered(
      "TELEPON : 0224209891   FAX : 0224218695   EMAIL : disdukcapilkotabdg@gmail.com",
      textY,
      10,
      helvetica,
    );
    textY -= 10;

    // garis dobel di bawah kop
    const lineY1 = textY - 6;
    const lineY2 = lineY1 - 2;

    page.drawLine({
      start: { x: margin, y: lineY1 },
      end: { x: margin + tableWidth, y: lineY1 },
      thickness: 1.6,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: margin, y: lineY2 },
      end: { x: margin + tableWidth, y: lineY2 },
      thickness: 0.9,
      color: rgb(0, 0, 0),
    });

    y = lineY2 - 22;
  };

  const drawHeaderBlock = () => {
    drawLetterhead();

    drawCentered("LAPORAN PELAKSANAAN TUGAS HARIAN", y, fontSizeTitle, helveticaBold);
    y -= 30;

    drawInfoRow("Nama", nama);
    drawInfoRow("Nik", nik);
    drawInfoRow("Perihal", "Laporan Pelaksanaan Tugas");
    drawInfoRow("Bulan", prettyMonth(period));

    y -= 18;
  };

  const drawTableHeader = () => {
    const headerY = y;
    const headers = ["No", "Tanggal", "Aktivitas", "Jumlah Aktivitas", "Paraf"];
    const headerHeight = 22;

    // background header
    page.drawRectangle({
      x: margin,
      y: headerY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: colorHeader,
    });

    // teks header → center di tiap cell
    headers.forEach((text, idx) => {
      const cellLeft = gridX[idx];
      const cellRight = gridX[idx + 1];
      const cellWidth = cellRight - cellLeft;
      const textWidth = helveticaBold.widthOfTextAtSize(text, fontSizeText);

      const textX = cellLeft + (cellWidth - textWidth) / 2;
      const textY =
        headerY -
        (headerHeight + fontSizeText) / 2 +
        3; // koreksi baseline supaya visual pas tengah

      page.drawText(text, {
        x: textX,
        y: textY,
        size: fontSizeText,
        font: helveticaBold,
      });
    });

    // garis vertikal di gridX
    gridX.forEach((x) => {
      page.drawLine({
        start: { x, y: headerY },
        end: { x, y: headerY - headerHeight },
        thickness: 0.9,
        color: colorBorder,
      });
    });

    // garis horizontal atas & bawah header
    page.drawLine({
      start: { x: margin, y: headerY },
      end: { x: margin + tableWidth, y: headerY },
      thickness: 0.9,
      color: colorBorder,
    });
    page.drawLine({
      start: { x: margin, y: headerY - headerHeight },
      end: { x: margin + tableWidth, y: headerY - headerHeight },
      thickness: 0.9,
      color: colorBorder,
    });

    y = headerY - headerHeight - 8;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeaderBlock();
      drawTableHeader();
    }
  };

  /* ------------------------- gambar konten ------------------------- */

  drawHeaderBlock();
  drawTableHeader();

  rows.forEach((row, idx) => {
    const noStr = String(idx + 1);
    const tanggalStr = toStr(row.TANGGAL);
    const aktivitasPure = formatActivities(toStr(row.DESCRIPTION));
    const jumlahPure = formatJumlah(toStr(row.JUMLAH));

    const aktivitasLines = wrapText(
      aktivitasPure,
      colWidths.aktivitas - 2 * CELL_PADDING_LEFT,
      helvetica,
      fontSizeText,
    );
    const jumlahLines = wrapText(
      jumlahPure,
      colWidths.jumlah - 2 * CELL_PADDING_LEFT,
      helvetica,
      fontSizeText,
    );

    const linesCount = Math.max(aktivitasLines.length, jumlahLines.length, 1);
    const contentHeight = fontSizeText + (linesCount - 1) * lineHeight;
    const rowHeight = CELL_PADDING_TOP + contentHeight + CELL_PADDING_BOTTOM;

    ensureSpace(rowHeight);

    const topY = y;
    const bottomY = y - rowHeight;

    // garis vertikal row di gridX
    gridX.forEach((x) => {
      page.drawLine({
        start: { x, y: topY },
        end: { x, y: bottomY },
        thickness: 0.8,
        color: colorBorder,
      });
    });

    // garis bawah row
    page.drawLine({
      start: { x: margin, y: bottomY },
      end: { x: margin + tableWidth, y: bottomY },
      thickness: 0.8,
      color: colorBorder,
    });

    // baseline pertama dalam cell
    let textY = topY - CELL_PADDING_TOP - fontSizeText;

    const centerCellText = (text: string, colIndex: number) => {
      const cellLeft = gridX[colIndex];
      const cellRight = gridX[colIndex + 1];
      const cellWidth = cellRight - cellLeft;
      const tw = helvetica.widthOfTextAtSize(text, fontSizeText);
      const tx = cellLeft + (cellWidth - tw) / 2;

      page.drawText(text, {
        x: tx,
        y: textY,
        size: fontSizeText,
        font: helvetica,
      });
    };

    // No (0) & Tanggal (1) center horizontal
    centerCellText(noStr, 0);
    centerCellText(tanggalStr, 1);

    // Aktivitas (2) & Jumlah (3) left align
    for (let i = 0; i < linesCount; i++) {
      const akt = aktivitasLines[i] ?? "";
      const jml = jumlahLines[i] ?? "";

      if (akt) {
        page.drawText(akt, {
          x: gridX[2] + CELL_PADDING_LEFT,
          y: textY,
          size: fontSizeText,
          font: helvetica,
        });
      }
      if (jml) {
        page.drawText(jml, {
          x: gridX[3] + CELL_PADDING_LEFT,
          y: textY,
          size: fontSizeText,
          font: helvetica,
        });
      }

      textY -= lineHeight;
    }

    y = bottomY;
  });

  return pdfDoc.save();
}

/* =======================================================================
 *  PARAM & HANDLER
 * ======================================================================= */

async function getParams(req: NextRequest): Promise<{ period: string; userId: string }> {
  if (req.method === "GET") {
    const { searchParams } = new URL(req.url);
    return {
      period: toStr(
        searchParams.get("pdf_tanggal") ||
          searchParams.get("tanggal") ||
          searchParams.get("period"),
      ),
      userId: toStr(searchParams.get("userId")),
    };
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    period: toStr(body.pdf_tanggal || body.tanggal || body.period || body.month),
    userId: toStr(body.userId || body.pdf_userid),
  };
}

async function handle(req: NextRequest) {
  const started = Date.now();
  const { ip, ua } = await getClientInfo();

  try {
    const session = await readServerSession();
    if (!session?.S_USER_ID) return unauthorized("Unauthorized");

    const { period, userId } = await getParams(req);
    const bulanTahun = normalizeMonthYear(period);
    if (!bulanTahun) return badRequest("Format tanggal harus MM-YYYY");

    const effectiveUserId = userId || session.S_USER_ID;

    const rows = await execRows<Row>(
      `
      SELECT 
        TO_CHAR(A.CREATED_DT,'DD-MM-YYYY') AS TANGGAL,
        LISTAGG(
          CASE 
            WHEN B.ACTIVITY = 'LAINNYA' 
              THEN CONCAT('- ', UPPER(A.DESCRIPTION)) 
            ELSE CONCAT('- ', B.ACTIVITY) 
          END,
          ' </BR>'
        ) WITHIN GROUP (ORDER BY TRUNC(A.CREATED_DT), A.DAILY_ID) AS DESCRIPTION,
        LISTAGG(
          A.NUMBER_ACTIVITY,
          ' Aktivitas </BR>'
        ) WITHIN GROUP (ORDER BY TRUNC(A.CREATED_DT), A.DAILY_ID) || ' Aktivitas' AS JUMLAH
      FROM SIAK_DAILY A 
      INNER JOIN SIAK_ACTIVITY B ON A.ACTIVITY_ID = B.ACTIVITY_ID 
      WHERE A.USER_ID = :b_user_id 
        AND TO_CHAR(A.CREATED_DT,'MM-YYYY') = :b_period 
      GROUP BY TO_CHAR(A.CREATED_DT,'DD-MM-YYYY'), TRUNC(A.CREATED_DT)
      ORDER BY TRUNC(A.CREATED_DT) DESC
      `,
      { b_user_id: effectiveUserId, b_period: bulanTahun },
      {},
      ORACLE_ALIAS,
    );

    const pdfBytes = await buildPdf(
      bulanTahun,
      rows,
      toStr(session.S_NAMA_LGKP),
      toStr(session.S_NIK),
    );
    const filename = `DAILY_${effectiveUserId}_${bulanTahun.replace("-", "")}.pdf`;

    await Log.info({
      scope: "API",
      msg: "getdaily/pdf2",
      at: AT,
      user: session.S_USER_ID,
      ip,
      ua,
      tookMs: Date.now() - started,
      extra: { period: bulanTahun, userId: effectiveUserId, count: rows.length },
    });

    const arrayBuffer = new Uint8Array(pdfBytes).buffer as ArrayBuffer;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e: any) {
    await Log.error({
      scope: "API",
      msg: "getdaily/pdf2_err",
      at: AT,
      tookMs: Date.now() - started,
      err: { name: e?.name ?? "Error", message: e?.message ?? String(e) },
    });
    return err(e?.message || "Gagal menyiapkan PDF");
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
