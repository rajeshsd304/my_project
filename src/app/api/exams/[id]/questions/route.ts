import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { loadManagedExam } from "@/lib/exam-api";
import { examHasAttempts } from "@/lib/exams";

const schema = z.object({ questionIds: z.array(z.string()).max(500, "An exam can have at most 500 questions.") });

/** Replace the exam's question list (in order). Locked once students have started. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error: loadError } = await loadManagedExam(user, (await params).id);
  if (loadError) return loadError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  if (await examHasAttempts(exam.id)) return jsonError("Questions are locked because students have already started this exam.", 409);

  const ids = [...new Set(data.questionIds)];
  const existing = await db.examQuestion.findMany({ where: { examId: exam.id }, select: { questionId: true } });
  const keep = new Set(existing.map((e) => e.questionId));
  // New questions must be live bank questions; ones already in the exam may stay even if archived.
  const valid = await db.question.count({ where: { id: { in: ids.filter((id) => !keep.has(id)) }, deletedAt: null } });
  if (valid !== ids.filter((id) => !keep.has(id)).length) return jsonError("Some questions no longer exist in the bank.");
  if (exam.status === "PUBLISHED" && ids.length === 0) return jsonError("A published exam needs at least one question. Set it to Draft first.");

  await db.$transaction([
    db.examQuestion.deleteMany({ where: { examId: exam.id } }),
    db.examQuestion.createMany({ data: ids.map((questionId, i) => ({ examId: exam.id, questionId, sortOrder: i })) }),
  ]);
  return NextResponse.json({ count: ids.length });
}
