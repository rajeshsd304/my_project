import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { loadManagedExam } from "@/lib/exam-api";

/** One-click copy: same settings, questions and batches; starts as a draft. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error } = await loadManagedExam(user, (await params).id);
  if (error) return error;
  const [questions, batches] = await Promise.all([
    db.examQuestion.findMany({ where: { examId: exam.id }, orderBy: { sortOrder: "asc" } }),
    db.examBatch.findMany({ where: { examId: exam.id } }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt, updatedAt, createdById, title, status, ...settings } = exam;
  const copy = await db.exam.create({
    data: {
      ...settings,
      title: `${title} (copy)`.slice(0, 150),
      status: "DRAFT",
      createdById: user.id,
      questions: { create: questions.map((q) => ({ questionId: q.questionId, sortOrder: q.sortOrder })) },
      batches: { create: batches.map((b) => ({ batchId: b.batchId })) },
    },
  });
  return NextResponse.json({ exam: { id: copy.id } }, { status: 201 });
}
