import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { checkExamSettings, examFields, examSettingsSchema } from "@/lib/exams";

export async function GET() {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const exams = await db.exam.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });
  return NextResponse.json({ exams });
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { data, error } = await parseBody(req, examSettingsSchema);
  if (error) return error;
  const problem = checkExamSettings(data);
  if (problem) return jsonError(problem);
  // A new exam has no questions yet, so it always starts as a draft.
  const exam = await db.exam.create({
    data: {
      ...examFields({ ...data, status: "DRAFT" }),
      createdById: user.id,
      batches: { create: data.audience === "BATCHES" ? data.batchIds.map((batchId) => ({ batchId })) : [] },
    },
  });
  return NextResponse.json({ exam: { id: exam.id } }, { status: 201 });
}
