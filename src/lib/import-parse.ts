import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { unzipSync } from "fflate";
import { brokenBanglaMessage, canonicalColumn, isRowBlank, MAX_IMPORT_ROWS, type ImportRow } from "./question-import";
import { sniffMime } from "./storage";

export class ImportFileError extends Error {}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return value.result == null ? "" : cellText(value.result as ExcelJS.CellValue);
    if ("error" in value) return "";
  }
  return String(value);
}

function toRows(header: string[], body: string[][], firstLine: number): { columns: string[]; rows: ImportRow[] } {
  const columns = header.map(canonicalColumn);
  if (!columns.some((c) => c.startsWith("question"))) {
    throw new ImportFileError('Could not find a "question" column in the first row. Use one of the templates.');
  }
  const rows: ImportRow[] = [];
  body.forEach((cells, i) => {
    const raw: Record<string, string> = {};
    columns.forEach((c, j) => {
      if (c && raw[c] === undefined) raw[c] = (cells[j] ?? "").toString();
    });
    if (!isRowBlank(raw)) rows.push({ line: i + firstLine, raw });
  });
  if (!rows.length) throw new ImportFileError("The file has no question rows.");
  if (rows.length > MAX_IMPORT_ROWS) throw new ImportFileError(`Too many rows (${rows.length}). The limit is ${MAX_IMPORT_ROWS} per import.`);
  return { columns, rows };
}

export async function parseQuestionFile(name: string, data: Uint8Array) {
  const isXlsx = /\.xlsx$/i.test(name) || (data[0] === 0x50 && data[1] === 0x4b);
  if (isXlsx) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    } catch {
      throw new ImportFileError("This Excel file could not be read. Save it as .xlsx (Excel Workbook) and try again.");
    }
    const sheet = wb.worksheets.find((s) => s.name.toLowerCase() === "questions") ?? wb.worksheets.find((s) => !/instruction/i.test(s.name));
    if (!sheet) throw new ImportFileError("The workbook has no sheet with questions.");
    const matrix: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row, n) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => (cells[col - 1] = cellText(cell.value)));
      matrix[n - 1] = cells;
    });
    const all = Array.from(matrix, (r) => r ?? []);
    const headerIdx = all.findIndex((r) => r.some((c) => c && c.trim()));
    if (headerIdx < 0) throw new ImportFileError("The sheet is empty.");
    return toRows(all[headerIdx], all.slice(headerIdx + 1), headerIdx + 2);
  }

  if (/\.xls$/i.test(name)) throw new ImportFileError("Old .xls files are not supported. Save the file as .xlsx or CSV UTF-8.");
  let text: string;
  try {
    // Accepts UTF-8 with or without BOM; anything else is rejected with a clear message.
    text = new TextDecoder("utf-8", { fatal: true }).decode(data).replace(/^﻿/, "");
  } catch {
    throw new ImportFileError(
      'This CSV is not saved as UTF-8, so Bangla text would be broken. In Excel choose File → Save As → "CSV UTF-8 (Comma delimited)", or upload the .xlsx file instead.',
    );
  }
  const broken = brokenBanglaMessage(text);
  if (broken) throw new ImportFileError(broken);
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const all = parsed.data;
  const headerIdx = all.findIndex((r) => r.some((c) => c && c.trim()));
  if (headerIdx < 0) throw new ImportFileError("The file is empty.");
  return toRows(all[headerIdx], all.slice(headerIdx + 1), headerIdx + 2);
}

/** Image files inside an uploaded ZIP, keyed by lower-cased basename. */
export function readImageZip(data: Uint8Array): Map<string, { name: string; mime: string; data: Uint8Array }> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, { filter: (f) => !f.name.startsWith("__MACOSX/") && f.originalSize <= 2 * 1024 * 1024 });
  } catch {
    throw new ImportFileError("The images file is not a valid ZIP archive.");
  }
  const images = new Map<string, { name: string; mime: string; data: Uint8Array }>();
  for (const [path, bytes] of Object.entries(entries)) {
    const name = path.split("/").pop()!;
    const mime = sniffMime(bytes);
    if (name && mime?.startsWith("image/")) images.set(name.toLowerCase(), { name, mime, data: bytes });
  }
  return images;
}
