import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { negativeRuleText, parseIds, SAVE_GRACE_MS, submitAttempt } from "@/lib/exams";
import { renderQuestion } from "@/lib/render-question";
import { ExamRunner, type RunnerQuestion } from "@/features/student/exam-runner";

export const metadata: Metadata = { title: "Exam" };

export default async function ExamScreen({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireRole("STUDENT");
  const { attemptId } = await params;
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, include: { exam: true, answers: true } });
  if (!attempt || attempt.userId !== user.id) notFound();
  if (attempt.status === "SUBMITTED") redirect(`/student/results/${attempt.id}`);
  if (attempt.deadlineAt && Date.now() > attempt.deadlineAt.getTime() + SAVE_GRACE_MS) {
    await submitAttempt(attempt.id, { auto: true, at: attempt.deadlineAt });
    redirect(`/student/results/${attempt.id}`);
  }

  const order = parseIds(attempt.questionOrder);
  const optionOrder: Record<string, string[]> = JSON.parse(attempt.optionOrder);
  // SECURITY: select only display fields. isCorrect and explanations never leave the server during an exam.
  const rows = await db.question.findMany({
    where: { id: { in: order } },
    select: {
      id: true,
      textBn: true,
      textEn: true,
      imageId: true,
      options: { select: { id: true, textBn: true, textEn: true } },
    },
  });
  const multiCounts = await db.questionOption.groupBy({ by: ["questionId"], where: { questionId: { in: order }, isCorrect: true }, _count: { _all: true } });
  const multi = new Set(multiCounts.filter((m) => m._count._all > 1).map((m) => m.questionId));
  const byId = new Map(rows.map((q) => [q.id, q]));

  const questions: RunnerQuestion[] = order.flatMap((qid) => {
    const q = byId.get(qid);
    if (!q) return [];
    const opts = new Map(q.options.map((o) => [o.id, o]));
    const ordered = (optionOrder[qid] ?? q.options.map((o) => o.id)).flatMap((id) => (opts.has(id) ? [opts.get(id)!] : []));
    return [{ id: qid, multi: multi.has(qid), view: renderQuestion({ ...q, options: ordered }) }];
  });

  const answers = Object.fromEntries(
    attempt.answers.map((a) => [a.questionId, { selected: parseIds(a.selected), marked: a.markedForReview }]),
  );

  return (
    <ExamRunner
      attemptId={attempt.id}
      title={attempt.exam.title}
      rule={negativeRuleText(attempt.exam)}
      marksPerQuestion={attempt.exam.marksPerQuestion}
      deadlineAt={attempt.deadlineAt?.toISOString() ?? null}
      serverNow={new Date().toISOString()}
      questions={questions}
      initialAnswers={answers}
    />
  );
}
