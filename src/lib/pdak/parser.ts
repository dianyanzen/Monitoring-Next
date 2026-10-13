import ExcelJS from "exceljs";
import { inflateRawSync } from "node:zlib";
import { parse as parseHtml } from "parse5";
import {
  DATASETS,
  DatasetConfig,
  DatasetType,
  normalizeHeader,
} from "./config";
import { validateHierarchy } from "./validate";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_ROWS = 500;
export const EXPECTED_REGION_COUNTS = {
  city: 1,
  district: 30,
  village: 151,
  total: 182,
};
const MAX_XLSX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MAX_XLSX_ENTRIES = 200;

export type ParsedRecord = Record<string, string | number | null>;
export type ParsedDataset = {
  config: DatasetConfig;
  rows: ParsedRecord[];
};

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

type GridSheet = {
  name: string;
  values: unknown[][];
  display: string[][];
};

type HtmlNode = {
  tagName?: string;
  nodeName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

function detectFileFormat(buffer: Buffer): "html" | "xlsx" {
  if (buffer.length < 4)
    throw new UploadValidationError("File kosong atau terlalu pendek.");
  const signature = buffer.subarray(0, 8);
  const isOle = signature.equals(
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  );
  if (isOle) {
    throw new UploadValidationError(
      "File .xls biner lama tidak didukung. Sumber PDAK menggunakan .xls berbentuk tabel HTML; unggah format tersebut atau simpan sebagai .xlsx.",
    );
  }
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return "xlsx";
  }
  const prefix = buffer
    .subarray(0, Math.min(buffer.length, 4096))
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart();
  if (
    /^(?:<!doctype\s+html|<html\b|<table\b|<!--)/i.test(prefix) ||
    /<(?:html|table)\b/i.test(prefix)
  ) {
    return "html";
  }
  throw new UploadValidationError(
    "Signature file tidak cocok dengan tabel HTML .xls atau workbook .xlsx.",
  );
}

function validateXlsxArchive(buffer: Buffer) {
  const minimumEocdOffset = Math.max(0, buffer.length - 65_557);
  let eocdOffset = -1;
  for (
    let offset = buffer.length - 22;
    offset >= minimumEocdOffset;
    offset -= 1
  ) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0)
    throw new UploadValidationError(
      "Workbook .xlsx tidak memiliki direktori ZIP yang valid.",
    );

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const directorySize = buffer.readUInt32LE(eocdOffset + 12);
  const directoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (
    buffer.readUInt16LE(eocdOffset + 4) !== 0 ||
    buffer.readUInt16LE(eocdOffset + 6) !== 0 ||
    buffer.readUInt16LE(eocdOffset + 8) !== entryCount ||
    entryCount > MAX_XLSX_ENTRIES ||
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff ||
    directoryOffset + directorySize > eocdOffset
  ) {
    throw new UploadValidationError(
      `Workbook .xlsx melewati batas ${MAX_XLSX_ENTRIES} entri atau arsip rusak.`,
    );
  }

  let offset = directoryOffset;
  let expandedSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > eocdOffset ||
      buffer.readUInt32LE(offset) !== 0x02014b50
    ) {
      throw new UploadValidationError(
        "Direktori ZIP workbook .xlsx tidak valid.",
      );
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    if (
      offset + 46 + fileNameLength + extraLength + commentLength >
        directoryOffset + directorySize ||
      localOffset + 30 > directoryOffset ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50
    )
      throw new UploadValidationError("Entri ZIP tidak valid.");
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");
    if (name.includes("..") || /vbaProject|externalLinks/i.test(name))
      throw new UploadValidationError(
        "Workbook berisi tautan eksternal atau macro.",
      );
    const dataOffset =
      localOffset +
      30 +
      buffer.readUInt16LE(localOffset + 26) +
      buffer.readUInt16LE(localOffset + 28);
    if (
      dataOffset + compressedSize > directoryOffset ||
      ![0, 8].includes(method)
    )
      throw new UploadValidationError("Kompresi ZIP tidak valid.");
    if ((flags & 1) !== 0 || uncompressedSize === 0xffffffff) {
      throw new UploadValidationError(
        "Workbook .xlsx terenkripsi atau menggunakan arsip ZIP yang tidak didukung.",
      );
    }
    expandedSize += uncompressedSize;
    if (expandedSize > MAX_XLSX_EXPANDED_BYTES) {
      throw new UploadValidationError(
        "Ukuran data workbook setelah diekstrak melebihi 50 MB.",
      );
    }
    try {
      const payload = buffer.subarray(dataOffset, dataOffset + compressedSize);
      const actual =
        method === 8
          ? inflateRawSync(payload, {
              maxOutputLength: Math.max(1, uncompressedSize),
            })
          : payload;
      if (
        actual.length !== uncompressedSize ||
        (name.endsWith(".xml") &&
          /<!DOCTYPE|<!ENTITY/i.test(actual.toString("utf8")))
      )
        throw new Error("Invalid XML or size");
    } catch {
      throw new UploadValidationError(
        "Data ZIP tidak sesuai ukuran atau XML tidak aman.",
      );
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset !== directoryOffset + directorySize) {
    throw new UploadValidationError(
      "Direktori ZIP workbook .xlsx tidak konsisten.",
    );
  }
}

function nodeText(node: HtmlNode): string {
  const name = node.tagName?.toLowerCase();
  if (name === "script" || name === "style") return "";
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(nodeText).join(" ");
}

function findTables(node: HtmlNode, tables: HtmlNode[] = []): HtmlNode[] {
  if (node.tagName?.toLowerCase() === "table") tables.push(node);
  for (const child of node.childNodes ?? []) findTables(child, tables);
  return tables;
}

function findRows(table: HtmlNode): HtmlNode[] {
  const rows: HtmlNode[] = [];
  const walk = (node: HtmlNode) => {
    for (const child of node.childNodes ?? []) {
      const tag = child.tagName?.toLowerCase();
      if (tag === "table") continue;
      if (tag === "tr") {
        rows.push(child);
        continue;
      }
      walk(child);
    }
  };
  walk(table);
  return rows;
}

function findCells(row: HtmlNode) {
  const cells: HtmlNode[] = [];
  const walk = (node: HtmlNode) => {
    for (const child of node.childNodes ?? []) {
      const tag = child.tagName?.toLowerCase();
      if (tag === "table") continue;
      if (tag === "td" || tag === "th") {
        cells.push(child);
        continue;
      }
      walk(child);
    }
  };
  walk(row);
  return cells;
}

function cellSpan(cell: HtmlNode, name: "rowspan" | "colspan") {
  const raw =
    cell.attrs?.find((attr) => attr.name.toLowerCase() === name)?.value ?? "1";
  const span = Number(raw);
  return Number.isInteger(span) && span > 0 ? Math.min(span, 100) : 1;
}

function expandHtmlTable(table: HtmlNode, index: number): GridSheet {
  const htmlRows = findRows(table);
  if (htmlRows.length > MAX_FILE_ROWS) {
    throw new UploadValidationError(
      `Tabel HTML ${index + 1} melewati batas ${MAX_FILE_ROWS} baris.`,
    );
  }
  const values: unknown[][] = [];
  const display: string[][] = [];
  for (let rowIndex = 0; rowIndex < htmlRows.length; rowIndex += 1) {
    values[rowIndex] ??= [];
    display[rowIndex] ??= [];
    let columnIndex = 0;
    for (const cell of findCells(htmlRows[rowIndex])) {
      while (values[rowIndex][columnIndex] !== undefined) columnIndex += 1;
      const text = nodeText(cell).replace(/\s+/g, " ").trim();
      const rowSpan = cellSpan(cell, "rowspan");
      const colSpan = cellSpan(cell, "colspan");
      if (columnIndex + colSpan > 100)
        throw new UploadValidationError("Tabel HTML melewati batas 100 kolom.");
      for (
        let r = rowIndex;
        r < Math.min(rowIndex + rowSpan, MAX_FILE_ROWS);
        r += 1
      ) {
        values[r] ??= [];
        display[r] ??= [];
        for (let c = columnIndex; c < columnIndex + colSpan; c += 1) {
          values[r][c] = text;
          display[r][c] = text;
        }
      }
      columnIndex += colSpan;
    }
  }
  if (display.some((row) => row.length > 100))
    throw new UploadValidationError("Tabel HTML melewati batas 100 kolom.");
  return { name: `HTML table ${index + 1}`, values, display };
}

function rawExcelValue(value: ExcelJS.CellValue): unknown {
  if (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }
  if ("formula" in value || "sharedFormula" in value)
    throw new UploadValidationError(
      "Formula Excel tidak diperbolehkan; gunakan nilai hasil ekspor PDAK.",
    );
  if ("text" in value) return value.text;
  if ("richText" in value)
    return value.richText.map((part) => part.text).join("");
  return null;
}

async function loadXlsx(buffer: Buffer): Promise<GridSheet[]> {
  validateXlsxArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    const copy = new Uint8Array(buffer.byteLength);
    copy.set(buffer);
    await workbook.xlsx.load(copy.buffer as ArrayBuffer);
  } catch {
    throw new UploadValidationError(
      "Struktur file tidak valid sebagai workbook .xlsx.",
    );
  }

  const sheets: GridSheet[] = [];
  for (const worksheet of workbook.worksheets) {
    if (worksheet.state !== "visible") continue;
    if (worksheet.rowCount > MAX_FILE_ROWS || worksheet.columnCount > 100) {
      throw new UploadValidationError(
        `Worksheet '${worksheet.name}' melewati batas ${MAX_FILE_ROWS} baris atau 100 kolom.`,
      );
    }
    const values: unknown[][] = [];
    const display: string[][] = [];
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      values[rowNumber - 1] = [];
      display[rowNumber - 1] = [];
      for (let column = 1; column <= worksheet.columnCount; column += 1) {
        const cell = row.getCell(column);
        values[rowNumber - 1][column - 1] = rawExcelValue(cell.value);
        display[rowNumber - 1][column - 1] = cell.text ?? "";
      }
    }
    sheets.push({ name: worksheet.name, values, display });
  }
  return sheets;
}

type HeaderMatch = {
  config: DatasetConfig;
  start: number;
  end: number;
  columns: number[];
  score: number;
};

function matchHeader(
  sheet: GridSheet,
  config: DatasetConfig,
): HeaderMatch | null {
  const expected = config.fields.map((field) => normalizeHeader(field.header));
  let best: HeaderMatch | null = null;
  const scanRows = Math.min(30, sheet.display.length);
  const scanCols = Math.min(
    100,
    Math.max(0, ...sheet.display.slice(0, 30).map((row) => row.length)),
  );

  for (let start = 0; start < scanRows; start += 1) {
    for (let end = start; end < Math.min(start + 3, scanRows); end += 1) {
      const matchesByField = new Map<number, number[]>();
      for (let col = 0; col < scanCols; col += 1) {
        const candidate = normalizeHeader(
          sheet.display
            .slice(start, end + 1)
            .map((row) => row[col] ?? "")
            .filter(Boolean)
            .join(" "),
        );
        const match = expected
          .map((header, index) => ({ header, index }))
          .filter(({ header }) => candidate === header)
          .sort((a, b) => b.header.length - a.header.length)[0];
        if (match) {
          const columns = matchesByField.get(match.index) ?? [];
          columns.push(col);
          matchesByField.set(match.index, columns);
        }
      }
      const columns = expected.map((_, index) => {
        const matches = matchesByField.get(index) ?? [];
        return matches.length === 1 ? matches[0] : -1;
      });
      const actual = Array.from({ length: scanCols }, (_, col) =>
        normalizeHeader(
          sheet.display
            .slice(start, end + 1)
            .map((r) => r[col] ?? "")
            .filter(Boolean)
            .join(" "),
        ),
      ).filter(Boolean);
      const score =
        actual.length === expected.length &&
        columns.every((col, i) => col === i)
          ? expected.length
          : Math.min(
              expected.length - 1,
              columns.filter((col) => col >= 0).length,
            );
      if (
        !best ||
        score > best.score ||
        (score === best.score && end - start < best.end - best.start)
      ) {
        best = { config, start, end, columns, score };
      }
    }
  }
  return best;
}

function displayValue(sheet: GridSheet, row: number, column: number) {
  return String(sheet.display[row]?.[column] ?? "").trim();
}

function parseNumeric(
  value: unknown,
  field: string,
  rowNumber: number,
): number | null {
  if (value == null || String(value).trim() === "") return null;
  if (value instanceof Date || typeof value === "boolean") {
    throw new UploadValidationError(
      `Baris ${rowNumber}: nilai ${field} bukan angka yang valid.`,
    );
  }
  if (typeof value === "number") {
    if (!validNumeric(value, field)) {
      throw new UploadValidationError(
        `Baris ${rowNumber}: nilai ${field} bukan angka nonnegatif yang valid.`,
      );
    }
    return value;
  }

  let text = String(value)
    .trim()
    .replace(/[\s\u00a0]/g, "");
  if (text === "-" || text === "—") return null;
  if (text.endsWith("%")) {
    if (!/(PERSEN|PERSENTASE)/.test(field)) {
      throw new UploadValidationError(
        `Baris ${rowNumber}: simbol persen tidak valid untuk ${field}.`,
      );
    }
    text = text.slice(0, -1);
  }
  if (!text || !/^[+]?\d[\d.,]*$/.test(text)) {
    throw new UploadValidationError(
      `Baris ${rowNumber}: nilai ${field} '${String(value)}' bukan angka yang valid.`,
    );
  }

  // Source exports use ungrouped decimal numbers. Do not guess locale/grouping.
  if (!/^\+?\d+(?:[.,]\d+)?$/.test(text))
    throw new UploadValidationError(
      `Baris ${rowNumber}: format angka ${field} ambigu atau tidak valid.`,
    );
  text = text.replace(",", ".");

  const parsed = Number(text);
  if (!validNumeric(parsed, field)) {
    throw new UploadValidationError(
      `Baris ${rowNumber}: nilai ${field} '${String(value)}' bukan angka nonnegatif yang valid.`,
    );
  }
  return parsed;
}

function validNumeric(value: number, field: string) {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER &&
    (/PERSEN/.test(field)
      ? value <= 100 &&
        Math.abs(value * 10000 - Math.round(value * 10000)) < 0.000001
      : Number.isInteger(value))
  );
}

function parseRows(sheet: GridSheet, match: HeaderMatch): ParsedDataset {
  const records: ParsedRecord[] = [];
  const seenCodes = new Set<string>();
  const noColumn = match.columns[0];
  const codeColumn = match.columns[1];
  const regionColumn = match.columns[2];

  for (
    let rowIndex = match.end + 1;
    rowIndex < sheet.values.length;
    rowIndex += 1
  ) {
    const row = sheet.values[rowIndex] ?? [];
    const noValue = row[noColumn];
    const code = displayValue(sheet, rowIndex, codeColumn);
    const name = displayValue(sheet, rowIndex, regionColumn);
    const hasMappedValues = match.columns.some(
      (column) =>
        column >= 0 && row[column] != null && String(row[column]).trim() !== "",
    );

    if (!hasMappedValues) continue;
    if (!code && (noValue == null || String(noValue).trim() === "")) {
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: baris berisi nilai PDAK tetapi tidak memiliki NO dan KODE.`,
      );
    }
    if (!code || noValue == null || String(noValue).trim() === "" || !name) {
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: kolom NO, KODE, atau WILAYAH kosong.`,
      );
    }
    if (!/^\d{2}\.\d{2}(?:\.\d{2}(?:\.\d{4})?)?$/.test(code)) {
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: KODE '${code}' bukan kode wilayah PDAK yang valid.`,
      );
    }
    const rowNumberValue = parseNumeric(noValue, "NO", rowIndex + 1);
    if (
      rowNumberValue == null ||
      !Number.isInteger(rowNumberValue) ||
      rowNumberValue < 1 ||
      rowNumberValue > 182
    ) {
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: NO harus berupa bilangan bulat 1 sampai 182.`,
      );
    }
    if (row.length !== match.config.fields.length)
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: jumlah kolom harus ${match.config.fields.length}.`,
      );
    if ([...name].length > 150 || /[\u0000-\u001f\u007f]/.test(name))
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: WILAYAH tidak valid atau terlalu panjang.`,
      );
    if (seenCodes.has(code)) {
      throw new UploadValidationError(
        `Baris ${rowIndex + 1}: KODE '${code}' duplikat di dalam file.`,
      );
    }
    seenCodes.add(code);

    const record: ParsedRecord = {};
    for (
      let fieldIndex = 0;
      fieldIndex < match.config.fields.length;
      fieldIndex += 1
    ) {
      const { column } = match.config.fields[fieldIndex];
      const value = row[match.columns[fieldIndex]];
      if (column === "NO") record[column] = rowNumberValue;
      else if (column === "KODE") record[column] = code;
      else if (column === "WILAYAH") record[column] = name;
      else record[column] = parseNumeric(value, column, rowIndex + 1);
    }
    records.push(record);
  }

  if (records.length !== EXPECTED_REGION_COUNTS.total) {
    throw new UploadValidationError(
      `Jumlah wilayah tidak sesuai: ditemukan ${records.length}, seharusnya ${EXPECTED_REGION_COUNTS.total} (1 kota, 30 kecamatan, 151 kelurahan).`,
    );
  }
  validateHierarchy(records);
  return { config: match.config, rows: records };
}

function findMatches(sheets: GridSheet[]) {
  return sheets.flatMap((sheet) =>
    DATASETS.map((config) => {
      const match = matchHeader(sheet, config);
      return match ? { sheet, match } : [];
    }).flat(),
  );
}

export async function parsePdaKFile(buffer: Buffer): Promise<ParsedDataset> {
  if (buffer.length > MAX_FILE_BYTES)
    throw new UploadValidationError("Ukuran file melebihi 10 MiB.");
  const format = detectFileFormat(buffer);
  if (
    format === "html" &&
    /<\s*(script|iframe|object|embed|svg|math)\b|\son[a-z]+\s*=|javascript\s*:|<!ENTITY/i.test(
      buffer.toString("utf8"),
    )
  )
    throw new UploadValidationError(
      "HTML aktif, script, dan entity eksternal tidak diperbolehkan.",
    );
  const tables =
    format === "html"
      ? findTables(
          parseHtml(
            buffer.toString("utf8").replace(/^\uFEFF/, ""),
          ) as unknown as HtmlNode,
        )
      : [];
  if (tables.length > 20)
    throw new UploadValidationError("Maksimal 20 tabel HTML.");
  const sheets =
    format === "xlsx" ? await loadXlsx(buffer) : tables.map(expandHtmlTable);

  if (!sheets.length)
    throw new UploadValidationError(
      "File tidak memiliki worksheet atau tabel yang dapat dibaca.",
    );
  if (sheets.length > 20)
    throw new UploadValidationError(
      "File melewati batas 20 worksheet atau tabel.",
    );

  const matches = findMatches(sheets)
    .filter(({ match }) => match.score === match.config.fields.length)
    .sort((a, b) => b.match.score - a.match.score);
  if (!matches.length) {
    const partial = findMatches(sheets).sort(
      (a, b) => b.match.score - a.match.score,
    )[0];
    const detail = partial
      ? ` Header terdeteksi ${partial.match.score}/${partial.match.config.fields.length} kolom untuk ${partial.match.config.label}.`
      : "";
    throw new UploadValidationError(
      `Struktur header tidak cocok dengan mapping dataset PDAK.${detail}`,
    );
  }
  if (matches.length > 1)
    throw new UploadValidationError(
      "File memuat lebih dari satu tabel atau worksheet PDAK.",
    );
  return parseRows(matches[0].sheet, matches[0].match);
}

export function isDatasetType(value: unknown): value is DatasetType {
  return DATASETS.some((dataset) => dataset.type === value);
}
