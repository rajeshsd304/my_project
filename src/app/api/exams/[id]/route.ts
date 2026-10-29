import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { loadManagedExam } from "@/lib/exam-api";
import { checkExamSettings, examFields, examHasAttempts, examSettingsSchema } from "@/lib/exams";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error: loadError } = await loadManagedExam(user, (await params).id);
  if (loadError) return loadError;
  const { data, error } = await parseBody(req, examSettingsSchema);
  if (error) return error;
  const problem = checkExamSettings(data);
  if (problem) return jsonError(problem);

  const fields = examFields(data);
  if (await examHasAttempts(exam.id)) {
    // Scoring is locked once any student has started.
    if (fields.negativeMarking !== exam.negativeMarking || fields.negativeMark !== exam.negativeMark) {
      return jsonError("Negative marking is locked because students have already started this exam.", 409);
    }
    if (fields.marksPerQuestion !== exam.marksPerQuestion) {
      return jsonError("Marks per question are locked because students have already started this exam.", 409);
    }
  }
  if (fields.status === "PUBLISHED" && !(await db.examQuestion.count({ where: { examId: exam.id } }))) {
    return jsonError("Add at least one question before publishing.");
  }
  await db.$transaction([
    db.examBatch.deleteMany({ where: { examId: exam.id } }),
    db.exam.update({
      where: { id: exam.id },
      data: { ...fields, batches: { create: data.audience === "BATCHES" ? data.batchIds.map((batchId) => ({ batchId })) : [] } },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error } = await loadManagedExam(user, (await params).id);
  if (error) return error;
  if (await examHasAttempts(exam.id)) {
    return jsonError("Students have already taken this exam, so it can't be deleted (that would erase their results). Set it to Draft to hide it.", 409);
  }
  await db.exam.delete({ where: { id: exam.id } });
  return NextResponse.json({ ok: true });
}
