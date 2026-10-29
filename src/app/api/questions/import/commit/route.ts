import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { ImportFileError, readImageZip } from "@/lib/import-parse";
import { checkRows, MAX_IMPORT_ROWS } from "@/lib/question-import";
import { checkPlacement, optionRows, questionFields } from "@/lib/questions";
import { readTemp, removeTemp, saveFile } from "@/lib/storage";

const schema = z.object({
  fileName: z.string().max(200),
  template: z.enum(["SIMPLE", "BOTH"]),
  language: z.enum(["BN", "EN"]),
  allowMultiple: z.boolean(),
  subjectId: z.string().min(1, "Choose a subject for the imported questions."),
  topicId: z.string().nullable().optional(),
  zipToken: z.string().nullable().optional(),
  rows: z
    .array(z.object({ line: z.number().int(), raw: z.record(z.string().max(5000)) }))
    .min(1)
    .max(MAX_IMPORT_ROWS),
});

/** Step 2: re-validate on the server and import every row without errors. */
export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  const placement = await checkPlacement(data.subjectId, data.topicId);
  if (placement) return jsonError(placement);

  let images = new Map<string, { name: string; mime: string; data: Uint8Array }>();
  if (data.zipToken) {
    const zip = await readTemp(data.zipToken);
    if (!zip) return jsonError("The uploaded images expired. Please upload the files again.");
    try {
      images = readImageZip(new Uint8Array(zip));
    } catch (err) {
      if (err instanceof ImportFileError) return jsonError(err.message);
      throw err;
    }
  }

  const ctx = { template: data.template, language: data.language, allowMultiple: data.allowMultiple, zipImages: data.zipToken ? [...images.keys()] : null };
  const checked = checkRows(data.rows, { ...ctx, bankHashes: [] });
  const valid = checked.filter((r) => r.question);
  const hashes = valid.map((r) => questionFields(r.question!).contentHash);
  const inBank = new Set(
    (await db.question.findMany({ where: { contentHash: { in: hashes }, deletedAt: null }, select: { contentHash: true } })).map((q) => q.contentHash),
  );
  const warnings = checked.filter((r) => r.question && (r.warnings.length || inBank.has(questionFields(r.question).contentHash))).length;

  // Save each referenced image once.
  const imageIds = new Map<string, string>();
  for (const key of new Set(valid.flatMap((r) => (r.image ? [r.image] : [])))) {
    const img = images.get(key);
    if (img) imageIds.set(key, (await saveFile({ name: img.name, mime: img.mime, data: img.data, userId: user.id })).id);
  }

  const record = await db.$transaction(
    async (tx) => {
      const imp = await tx.questionImport.create({
        data: {
          createdById: user.id,
          fileName: data.fileName,
          template: data.template,
          totalRows: data.rows.length,
          importedCount: valid.length,
          skippedCount: data.rows.length - valid.length,
          warningCount: warnings,
        },
      });
      for (const row of valid) {
        await tx.question.create({
          data: {
            ...questionFields(row.question!),
            subjectId: data.subjectId,
            topicId: data.topicId || null,
            imageId: row.image ? (imageIds.get(row.image) ?? null) : null,
            createdById: user.id,
            importId: imp.id,
            options: { create: optionRows(row.question!) },
          },
        });
      }
      return imp;
    },
    { timeout: 120_000 },
  );
  if (data.zipToken) await removeTemp(data.zipToken);

  return NextResponse.json({
    importId: record.id,
    imported: record.importedCount,
    skipped: record.skippedCount,
    warnings: record.warningCount,
  });
}
