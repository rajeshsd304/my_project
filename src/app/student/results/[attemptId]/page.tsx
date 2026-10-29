import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { finalizeExpiredAttempts, formatDuration, negativeRuleText, resultsReleased, reviewReleased } from "@/lib/exams";
import { formatDateTime, formatNumber } from "@/lib/format";
import { attemptRank, isStrong, isWeak, performanceBreakdown } from "@/lib/results";
import { BarList } from "@/components/charts";
import { Icon } from "@/components/icons";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Result" };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireRole("STUDENT");
  const { attemptId } = await params;
  await finalizeExpiredAttempts({ id: attemptId });
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, include: { exam: true } });
  if (!attempt || attempt.userId !== user.id) notFound();
  const exam = attempt.exam;
  if (attempt.status !== "SUBMITTED") {
    return (
      <>
        <PageHeader title={exam.title} />
        <Alert tone="info">This exam is still in progress. <Link href={`/exam/${attempt.id}`} className="font-semibold underline">Resume</Link></Alert>
      </>
    );
  }
  if (!resultsReleased(exam)) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={exam.title} />
        <div className="card p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success"><Icon name="check" className="size-6" /></span>
          <h2 className="mt-4 text-lg font-semibold">Your answers have been submitted</h2>
          <p className="mt-1 text-sm text-muted">Results will be published after the exam ends at {formatDateTime(exam.endsAt)}.</p>
          <Link href="/student" className="btn btn-secondary mt-5">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const [rank, breakdown] = await Promise.all([attemptRank(attempt), performanceBreakdown([attempt.id])]);
  const passed = exam.passMark != null ? (attempt.score ?? 0) >= exam.passMark : null;
  const review = reviewReleased(exam);
  const showBoard = exam.showLeaderboard;

  const tiles: [string, string, string?][] = [
    ["Correct", String(attempt.correct), "text-success"],
    ["Wrong", String(attempt.wrong), "text-danger"],
    ["Skipped", String(attempt.skipped)],
    ["Negative marks", attempt.negativeTotal ? `−${formatNumber(attempt.negativeTotal)}` : "0", attempt.negativeTotal ? "text-warning" : undefined],
    ["Time taken", formatDuration(attempt.timeTakenSec)],
    // The rank is shown large in the hero when available; the tile only explains a missing rank.
    ...(rank ? [] : [["Rank", attempt.attemptNo > 1 ? "Retake (not ranked)" : "—"] as [string, string]]),
  ];

  return (
    <>
      <PageHeader
        title={exam.title}
        description={`Submitted ${formatDateTime(attempt.submittedAt)}${attempt.autoSubmitted ? " (auto-submitted when time ran out)" : ""} · ${negativeRuleText(exam)}`}
        actions={
          <>
            <a href={`/api/attempts/${attempt.id}/slip`} className="btn btn-secondary"><Icon name="download" className="size-4" /> Result slip (PDF)</a>
            {showBoard && <Link href={`/student/leaderboard?exam=${exam.id}`} className="btn btn-ghost"><Icon name="trophy" className="size-4" /> Leaderboard</Link>}
          </>
        }
      />

      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm text-muted">Your score</div>
            <div className="mt-1 text-5xl font-bold tabular-nums sm:text-6xl">
              {formatNumber(attempt.score)}
              <span className="text-2xl font-semibold text-subtle"> / {formatNumber(attempt.totalMarks)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-accent-text tabular-nums">{formatNumber(attempt.percentage)}%</span>
              {passed !== null && (
                <span className={`badge gap-1 ${passed ? "border-success/40 bg-success-soft text-success" : "border-danger/40 bg-danger-soft text-danger"}`}>
                  <Icon name={passed ? "check" : "close"} className="size-3" /> {passed ? "Passed" : "Not passed"} (pass mark {formatNumber(exam.passMark)})
                </span>
              )}
            </div>
          </div>
          {rank && (
            <div className="sm:text-right">
              <div className="text-sm text-muted">Merit position</div>
              <div className="mt-1 text-4xl font-bold tabular-nums">#{rank.rank}<span className="text-lg font-semibold text-subtle"> of {rank.of}</span></div>
            </div>
          )}
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map(([k, v, tone]) => (
            <div key={k} className="rounded-xl border border-line bg-surface-2 p-3">
              <dt className="text-xs text-subtle">{k}</dt>
              <dd className={`mt-1 text-lg font-bold tabular-nums ${tone ?? ""}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Subject-wise performance</h2>
          <p className="mb-4 text-xs text-subtle">Accuracy = correct ÷ questions in that subject.</p>
          <BarList items={breakdown.subjects.map((b) => ({ id: b.id, label: b.name, value: b.accuracy, detail: `${b.correct}/${b.total}`, flag: isWeak(b) ? "weak" : isStrong(b) ? "strong" : undefined }))} />
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Topic-wise performance</h2>
          <p className="mb-4 text-xs text-subtle">Weakest topics first.</p>
          <BarList items={breakdown.topics.map((b) => ({ id: b.id, label: b.name, value: b.accuracy, detail: `${b.correct}/${b.total}`, flag: isWeak(b) ? "weak" : isStrong(b) ? "strong" : undefined }))} />
        </section>
      </div>

      <div className="mt-6">
        {review ? (
          <Link href={`/student/results/${attempt.id}/review`} className="btn btn-primary w-full sm:w-auto"><Icon name="book" className="size-4" /> Review answers</Link>
        ) : (
          <Alert tone="info">Answer review (with correct answers) opens after the live exam ends at {formatDateTime(exam.endsAt)}.</Alert>
        )}
      </div>
    </>
  );
}
