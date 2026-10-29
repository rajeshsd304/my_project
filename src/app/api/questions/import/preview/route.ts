import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { ImportFileError, parseQuestionFile, readImageZip } from "@/lib/import-parse";
import { detectTemplate, rowHashes, type TemplateKind } from "@/lib/question-import";
import { stageTemp } from "@/lib/storage";

/**
 * Step 1 of an import: parse the file and return its rows for preview. Nothing is saved
 * except the optional images ZIP, which is staged until commit.
 */
export async function POST(req: Request) {
  const { error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const zip = form?.get("images");
  if (!(file instanceof File) || file.size === 0) return jsonError("Choose a .xlsx or .csv file.");
  if (file.size > 10 * 1024 * 1024) return jsonError("The file is too large (max 10 MB).");
  if (zip instanceof File && zip.size > 50 * 1024 * 1024) return jsonError("The images ZIP is too large (max 50 MB).");

  const chosen: TemplateKind = form?.get("template") === "BOTH" ? "BOTH" : "SIMPLE";
  const language = form?.get("language") === "EN" ? "EN" : "BN";
  const allowMultiple = form?.get("allowMultiple") === "true";

  try {
    const { columns, rows } = await parseQuestionFile(file.name, new Uint8Array(await file.arrayBuffer()));
    const template = detectTemplate(columns);
    const notice =
      template !== chosen
        ? template === "BOTH"
          ? "This file has Bangla/English columns (question_bn, question_en…), so it was read with the both-language template."
          : "This file has single-language columns (question, option_a…), so it was read with the simple template."
        : null;

    let zipImages: string[] | null = null;
    let zipToken: string | null = null;
    if (zip instanceof File && zip.size > 0) {
      const bytes = new Uint8Array(await zip.arrayBuffer());
      zipImages = [...readImageZip(bytes).keys()];
      zipToken = await stageTemp(bytes);
    }

    const hashes = rowHashes(rows, { template, language, allowMultiple, zipImages });
    const existing = hashes.length
      ? await db.question.findMany({ where: { contentHash: { in: hashes }, deletedAt: null }, select: { contentHash: true } })
      : [];

    return NextResponse.json({
      fileName: file.name,
      template,
      notice,
      columns,
      rows,
      zipImages,
      zipToken,
      bankHashes: [...new Set(existing.map((e) => e.contentHash))],
    });
  } catch (err) {
    if (err instanceof ImportFileError) return jsonError(err.message);
    throw err;
  }
}
