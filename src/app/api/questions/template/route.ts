import ExcelJS from "exceljs";
import Papa from "papaparse";
import { requireApiRole } from "@/lib/auth";
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLES, type TemplateKind } from "@/lib/question-import";

const FONT = { name: "Hind Siliguri", size: 12 };
const ROWS_WITH_DROPDOWNS = 2000;

const INSTRUCTIONS: Record<TemplateKind, string[]> = {
  SIMPLE: [
    "NextCampus question import: Simple template (one language)",
    "",
    "1. Fill one question per row in the \"Questions\" sheet. Delete or replace the 3 example rows.",
    "2. Before uploading, choose the language of this file (Bangla or English) in the import screen.",
    "3. Required: question, at least 2 options (option_a, option_b…), correct_answer.",
    "4. Optional: explanation, difficulty, tags, image. Extra columns option_e / option_f are allowed.",
    "5. correct_answer: A, B, C or D (also 1–4 or ক, খ, গ, ঘ). Multiple answers like \"A,C\" need the \"Allow multiple correct answers\" switch.",
    "6. difficulty: Easy, Medium or Hard (also 1, 2, 3). Empty means Medium.",
    "7. tags: separate with commas or semicolons, e.g. \"physics; motion\".",
    "8. Math/science formulas: wrap in $…$ for inline or $$…$$ for a separate line, e.g. $x^2 + y^2 = r^2$ or $H_2O$. Write \\$ for a literal dollar sign.",
    "9. image: the file name of a picture (e.g. q12.png). Upload all pictures together as one ZIP file.",
    "10. If you save as CSV, choose \"CSV UTF-8 (Comma delimited)\" so Bangla text is kept.",
    "11. You will see a preview of every row before anything is saved, and you can fix rows there.",
  ],
  BOTH: [
    "NextCampus question import: Both-language template (Bangla + English)",
    "",
    "1. Fill one question per row in the \"Questions\" sheet. Delete or replace the 3 example rows.",
    "2. Each row can be Bangla only, English only, or both. The display language is detected from the filled columns:",
    "   • only *_bn columns → Bangla   • only *_en columns → English   • both → Bangla first, English below.",
    "3. Required: question_bn or question_en (or both), at least 2 options, correct_answer.",
    "4. For a both-language question, fill both languages for every option (option_a_bn and option_a_en, …).",
    "5. correct_answer: A, B, C or D (also 1–4 or ক, খ, গ, ঘ). Multiple answers like \"A,C\" need the \"Allow multiple correct answers\" switch.",
    "6. difficulty: Easy, Medium or Hard (also 1, 2, 3). Empty means Medium.",
    "7. tags: separate with commas or semicolons.",
    "8. Math/science formulas: wrap in $…$ for inline or $$…$$ for a separate line, e.g. $\\frac{1}{2}mv^2$.",
    "9. image: the file name of a picture (e.g. q12.png). Upload all pictures together as one ZIP file.",
    "10. If you save as CSV, choose \"CSV UTF-8 (Comma delimited)\" so Bangla text is kept.",
  ],
};

export async function GET(req: Request) {
  const { error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const kind: TemplateKind = sp.get("type") === "both" ? "BOTH" : "SIMPLE";
  const columns = TEMPLATE_COLUMNS[kind];
  const examples = TEMPLATE_EXAMPLES[kind];
  const base = `nextcampus-questions-${kind === "BOTH" ? "bangla-english" : "simple"}`;

  if (sp.get("format") === "csv") {
    const csv = Papa.unparse({ fields: columns, data: examples.map((e) => columns.map((c) => e[c] ?? "")) });
    return new Response("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "NextCampus";
  const sheet = wb.addWorksheet("Questions", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((c) => ({
    header: c,
    key: c,
    width: c.startsWith("question") || c.startsWith("explanation") ? 48 : c === "correct_answer" ? 16 : c === "tags" ? 26 : 20,
    style: { font: FONT, alignment: { vertical: "top", wrapText: true } },
  }));
  examples.forEach((e) => sheet.addRow(e));
  const header = sheet.getRow(1);
  header.font = { ...FONT, bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A6BFF" } };
  header.height = 22;

  const colLetter = (key: string) => sheet.getColumn(key).letter;
  for (let r = 2; r <= ROWS_WITH_DROPDOWNS; r++) {
    // "information" style shows the list but still accepts other values like "A,C" or "ক".
    sheet.getCell(`${colLetter("correct_answer")}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"A,B,C,D"'],
      errorStyle: "information",
      showErrorMessage: true,
      errorTitle: "Correct answer",
      error: "Usually A, B, C or D. Multiple answers like A,C are allowed only if enabled during import.",
    };
    sheet.getCell(`${colLetter("difficulty")}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Easy,Medium,Hard"'],
      errorStyle: "warning",
      showErrorMessage: true,
      errorTitle: "Difficulty",
      error: "Choose Easy, Medium or Hard.",
    };
  }

  const help = wb.addWorksheet("Instructions");
  help.getColumn(1).width = 120;
  INSTRUCTIONS[kind].forEach((line, i) => {
    const row = help.addRow([line]);
    row.font = { ...FONT, bold: i === 0, size: i === 0 ? 14 : 12 };
    row.alignment = { wrapText: true };
  });
  help.addRow([]);
  help.addRow(["Columns: " + columns.join(", ")]).font = { ...FONT, italic: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  });
}
