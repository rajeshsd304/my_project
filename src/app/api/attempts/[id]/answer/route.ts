import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { loadOwnAttempt } from "@/lib/attempt-api";
import { SAVE_GRACE_MS, submitAttempt } from "@/lib/exams";

const answer = z.object({
  questionId: z.string(),
  selected: z.array(z.string()).max(6),
  marked: z.boolean().default(false),
});
const schema = z.object({ answers: z.array(answer).min(1).max(500) });

/**
 * Save one or more answers (the client sends each change instantly, and flushes a queue
 * after reconnecting). The response never says whether an answer is right.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireApiRole("STUDENT");
  if (authError) return authError;
  const { attempt, error: loadError } = await loadOwnAttempt(user, (await params).id);
  if (loadError) return loadError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  if (attempt.status !== "IN_PROGRESS") return jsonError("This exam has already been submitted.", 409, { submitted: true });
  const now = new Date();
  if (attempt.deadlineAt && now.getTime() > attempt.deadlineAt.getTime() + SAVE_GRACE_MS) {
    await submitAttempt(attempt.id, { auto: true, at: attempt.deadlineAt });
    return jsonError("Time is up. Your exam has been submitted.", 409, { submitted: true });
  }

  const optionOrder: Record<string, string[]> = JSON.parse(attempt.optionOrder);
  for (const a of data.answers) {
    const allowed = optionOrder[a.questionId];
    if (!allowed) return jsonError("Question is not part of this exam.");
    if (!a.selected.every((id) => allowed.includes(id))) return jsonError("Invalid option.");
  }
  await db.$transaction(
    data.answers.map((a) =>
      db.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } },
        create: { attemptId: attempt.id, questionId: a.questionId, selected: JSON.stringify([...new Set(a.selected)]), markedForReview: a.marked },
        update: { selected: JSON.stringify([...new Set(a.selected)]), markedForReview: a.marked },
      }),
    ),
  );
  return NextResponse.json({ ok: true, serverNow: now, deadlineAt: attempt.deadlineAt });
}
