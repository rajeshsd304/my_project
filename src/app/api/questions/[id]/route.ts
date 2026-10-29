import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { validateQuestion } from "@/lib/question-content";
import { canEditQuestion, checkPlacement, deleteQuestions, optionRows, questionFields, questionSchema, toInput } from "@/lib/questions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const { id } = await params;
  const question = await db.question.findFirst({
    where: { id, deletedAt: null },
    include: { options: { orderBy: { sortOrder: "asc" } }, subject: { select: { unitId: true } } },
  });
  if (!question) return jsonError("Question not found.", 404);
  return NextResponse.json({ question });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { id } = await params;
  const existing = await db.question.findFirst({ where: { id, deletedAt: null }, select: { createdById: true } });
  if (!existing) return jsonError("Question not found.", 404);
  if (!canEditQuestion(user, existing)) return jsonError("You can only edit your own questions.", 403);

  const { data, error } = await parseBody(req, questionSchema);
  if (error) return error;
  const input = toInput(data);
  const problems = validateQuestion(input);
  if (problems.length) return jsonError(problems[0], 400, { errors: problems });
  const placement = await checkPlacement(data.subjectId, data.topicId);
  if (placement) return jsonError(placement);

  await db.$transaction([
    db.questionOption.deleteMany({ where: { questionId: id } }),
    db.question.update({
      where: { id },
      data: {
        ...questionFields(input),
        subjectId: data.subjectId,
        topicId: data.topicId || null,
        imageId: data.imageId || null,
        options: { create: optionRows(input) },
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const { id } = await params;
  const existing = await db.question.findFirst({ where: { id, deletedAt: null }, select: { createdById: true } });
  if (!existing) return jsonError("Question not found.", 404);
  if (!canEditQuestion(user, existing)) return jsonError("You can only delete your own questions.", 403);
  return NextResponse.json(await deleteQuestions([id]));
}
