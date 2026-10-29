import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { reviewReleased } from "@/lib/exams";
import { formatDateTime, formatNumber } from "@/lib/format";
import { renderQuestion } from "@/lib/render-question";
import { attemptReview } from "@/lib/results";
import { QuestionView } from "@/components/question-view";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Answer review" };

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ attemptId: string }>; searchParams: Promise<{ filter?: string }> }) {
  const user = await requireRole("STUDENT");
  const { attemptId } = await params;
  const { filter } = await searchParams;
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, include: { exam: true } });
  if (!attempt || attempt.userId !== user.id || attempt.status !== "SUBMITTED") notFound();
  if (!reviewReleased(attempt.exam)) {
    return (
      <>
        <PageHeader title="Answer review" />
        <Alert tone="info">The answer review opens after the live exam ends at {formatDateTime(attempt.exam.endsAt)}.</Alert>
      </>
    );
  }
  const rows = await attemptReview(attempt.id);
  const showExplanations = attempt.exam.showExplanations;
  const visible = rows.map((r, i) => ({ ...r, number: i + 1 })).filter((r) => (filter === "wrong" ? r.isCorrect === false : filter === "skipped" ? r.isCorrect === null : filter === "correct" ? r.isCorrect === true : true));
  const tabs: [string, string, number][] = [
    ["", "All", rows.length],
    ["wrong", "Wrong", rows.filter((r) => r.isCorrect === false).length],
    ["skipped", "Skipped", rows.filter((r) => r.isCorrect === null).length],
    ["correct", "Correct", rows.filter((r) => r.isCorrect === true).length],
  ];

  return (
    <>
      <PageHeader title="Answer review" description={attempt.exam.title} actions={<Link href={`/student/results/${attempt.id}`} className="btn btn-ghost">Back to result</Link>} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter questions">
        {tabs.map(([key, label, n]) => (
          <Link key={label} href={`/student/results/${attempt.id}/review${key ? `?filter=${key}` : ""}`} className={`btn min-h-9 px-3 py-1.5 text-xs ${(filter ?? "") === key ? "btn-primary" : "btn-secondary"}`}>
            {label} ({n})
          </Link>
        ))}
      </nav>
      <ol className="space-y-4">
        {visible.map((r) => {
          const correctIds = r.question.options.filter((o) => o.isCorrect).map((o) => o.id);
          const status = r.isCorrect === true ? ["Correct", "border-success/40 bg-success-soft text-success"] : r.isCorrect === false ? ["Wrong", "border-danger/40 bg-danger-soft text-danger"] : ["Skipped", "border-line-strong text-muted"];
          return (
            <li key={r.question.id} className="card p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={`badge ${status[1]}`}>{status[0]}</span>
                <span className="text-subtle">{r.question.subject.name}{r.question.topic ? ` › ${r.question.topic.name}` : ""}</span>
                <span className="ml-auto font-semibold tabular-nums">{r.marks > 0 ? "+" : ""}{formatNumber(r.marks)} marks</span>
              </div>
              <QuestionView
                number={r.number}
                data={renderQuestion(r.question, { explanation: showExplanations })}
                multi={correctIds.length > 1}
                optionState={(id) => {
                  const chosen = r.selected.includes(id);
                  const right = correctIds.includes(id);
                  if (chosen && right) return "correct";
                  if (chosen) return "wrong";
                  if (right) return "missed";
                  return "idle";
                }}
              />
              {r.isCorrect === null && <p className="mt-3 text-xs text-muted">You skipped this question. The correct answer is outlined.</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
