import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { validateQuestion } from "@/lib/question-content";
import { checkPlacement, optionRows, questionFields, questionListSelect, questionSchema, questionWhere, toInput } from "@/lib/questions";

export async function GET(req: Request) {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const sp = new URL(req.url).searchParams;
  const where = questionWhere(
    {
      q: sp.get("q") ?? undefined,
      unitId: sp.get("unitId") ?? undefined,
      subjectId: sp.get("subjectId") ?? undefined,
      topicId: sp.get("topicId") ?? undefined,
      difficulty: sp.get("difficulty") ?? undefined,
      tag: sp.get("tag") ?? undefined,
      language: sp.get("language") ?? undefined,
      mine: sp.get("mine") === "1",
    },
    user,
  );
  const take = Math.min(100, Number(sp.get("take")) || 30);
  const skip = Math.max(0, Number(sp.get("skip")) || 0);
  const exclude = sp.get("exclude")?.split(",").filter(Boolean);
  const finalWhere = exclude?.length ? { AND: [where, { id: { notIn: exclude } }] } : where;
  const [questions, total] = await Promise.all([
    db.question.findMany({ where: finalWhere, select: questionListSelect, orderBy: { createdAt: "desc" }, take, skip }),
    db.question.count({ where: finalWhere }),
  ]);
  return NextResponse.json({ questions, total });
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { data, error } = await parseBody(req, questionSchema);
  if (error) return error;
  const input = toInput(data);
  const problems = validateQuestion(input);
  if (problems.length) return jsonError(problems[0], 400, { errors: problems });
  const placement = await checkPlacement(data.subjectId, data.topicId);
  if (placement) return jsonError(placement);

  const fields = questionFields(input);
  const duplicates = await db.question.count({ where: { contentHash: fields.contentHash, deletedAt: null } });
  const question = await db.question.create({
    data: {
      ...fields,
      subjectId: data.subjectId,
      topicId: data.topicId || null,
      imageId: data.imageId || null,
      createdById: user.id,
      options: { create: optionRows(input) },
    },
    select: { id: true },
  });
  return NextResponse.json(
    { question, warning: duplicates ? "A question with the same text already exists in the bank." : undefined },
    { status: 201 },
  );
}
