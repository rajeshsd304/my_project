import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { loadManagedExam } from "@/lib/exam-api";
import { examHasAttempts } from "@/lib/exams";
import { DIFFICULTIES } from "@/lib/question-content";

const schema = z.object({
  unitId: z.string().nullable().optional(),
  subjectId: z.string().nullable().optional(),
  topicId: z.string().nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).nullable().optional(),
  count: z.number().int().min(1).max(200),
});

/** Append `count` random bank questions matching the filters (never duplicates). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error: loadError } = await loadManagedExam(user, (await params).id);
  if (loadError) return loadError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  if (await examHasAttempts(exam.id)) return jsonError("Questions are locked because students have already started this exam.", 409);

  const current = await db.examQuestion.findMany({ where: { examId: exam.id }, select: { questionId: true }, orderBy: { sortOrder: "asc" } });
  const pool = await db.question.findMany({
    where: {
      deletedAt: null,
      id: { notIn: current.map((c) => c.questionId) },
      ...(data.topicId ? { topicId: data.topicId } : {}),
      ...(data.subjectId ? { subjectId: data.subjectId } : data.unitId ? { subject: { unitId: data.unitId } } : {}),
      ...(data.difficulty ? { difficulty: data.difficulty } : {}),
    },
    select: { id: true },
  });
  if (!pool.length) return jsonError("No unused questions match these filters.");
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, data.count);
  await db.examQuestion.createMany({
    data: picked.map((q, i) => ({ examId: exam.id, questionId: q.id, sortOrder: current.length + i })),
  });
  return NextResponse.json({ added: picked.length, available: pool.length });
}
