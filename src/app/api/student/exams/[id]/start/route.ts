import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { buildAttemptLayout, finalizeExpiredAttempts, startEligibility, studentExamWhere } from "@/lib/exams";

/** Start a new attempt, or return the one already in progress (resume after refresh/disconnect). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiRole("STUDENT");
  if (error) return error;
  const { id } = await params;
  const exam = await db.exam.findFirst({ where: { id, ...studentExamWhere(user) } });
  if (!exam) return jsonError("Exam not found.", 404);
  await finalizeExpiredAttempts({ examId: exam.id, userId: user.id });

  const eligible = await startEligibility(exam, user.id);
  if (!eligible.ok) return jsonError(eligible.reason, 409);
  if (eligible.resume) return NextResponse.json({ attemptId: eligible.resume.id, resumed: true });

  const layout = await buildAttemptLayout(exam);
  if (!layout.questionOrder.length) return jsonError("This exam has no questions yet.", 409);
  const attemptNo = (eligible.attempts[0]?.attemptNo ?? 0) + 1;
  try {
    const attempt = await db.attempt.create({
      data: {
        examId: exam.id,
        userId: user.id,
        attemptNo,
        deadlineAt: layout.deadline,
        questionOrder: JSON.stringify(layout.questionOrder),
        optionOrder: JSON.stringify(layout.optionOrder),
      },
    });
    return NextResponse.json({ attemptId: attempt.id, resumed: false }, { status: 201 });
  } catch {
    // Double click / two tabs: the unique (exam, user, attemptNo) index lets only one through.
    const existing = await db.attempt.findFirst({ where: { examId: exam.id, userId: user.id, status: "IN_PROGRESS" } });
    if (existing) return NextResponse.json({ attemptId: existing.id, resumed: true });
    return jsonError("Could not start the exam. Please try again.", 409);
  }
}
