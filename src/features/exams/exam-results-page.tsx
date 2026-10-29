import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { canManageExam, formatDuration } from "@/lib/exams";
import { formatNumber } from "@/lib/format";
import { renderRich } from "@/lib/rich";
import { examAnalytics, examLeaderboard } from "@/lib/results";
import { BarList, Histogram } from "@/components/charts";
import { Icon } from "@/components/icons";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Alert, EmptyState, PageHeader, StatCard } from "@/components/ui";

export async function ExamResultsPage({ user, base, id }: { user: CurrentUser; base: string; id: string }) {
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) notFound();
  if (!canManageExam(user, exam)) return <Alert tone="error">You can only see results of exams you created.</Alert>;
  const [a, board] = await Promise.all([examAnalytics(exam), examLeaderboard(exam.id)]);
  const hardest = [...a.questions].sort((x, y) => x.pctCorrect - y.pctCorrect);
  const mostSkipped = [...a.questions].filter((q) => q.skipped > 0).sort((x, y) => y.pctSkipped - x.pctSkipped).slice(0, 5);
  const snippet = (q: { textBn: string | null; textEn: string | null }) => renderRich(q.textBn ?? q.textEn ?? "");

  return (
    <>
      <PageHeader
        title={`Results · ${exam.title}`}
        description={`${a.count} student${a.count === 1 ? "" : "s"} (first attempts) · total ${formatNumber(a.totalMarks)} marks`}
        actions={
          <>
            <a href={`/api/exams/${exam.id}/export?format=xlsx`} className="btn btn-secondary"><Icon name="download" className="size-4" /> Excel</a>
            <a href={`/api/exams/${exam.id}/export?format=csv`} className="btn btn-ghost"><Icon name="download" className="size-4" /> CSV</a>
            <Link href={`${base}/exams/${exam.id}`} className="btn btn-ghost">Edit exam</Link>
          </>
        }
      />
      {a.count === 0 ? (
        <EmptyState icon="chart" title="No submissions yet">Results and analytics appear here as soon as students submit.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <StatCard label="Submissions" value={a.count} icon="users" />
            <StatCard label="Average" value={formatNumber(a.average)} icon="chart" hint={`${formatNumber(((a.average ?? 0) / (a.totalMarks || 1)) * 100)}%`} />
            <StatCard label="Highest" value={formatNumber(a.highest)} icon="trophy" />
            <StatCard label="Lowest" value={formatNumber(a.lowest)} icon="chart" />
            <StatCard label={a.passRate == null ? "Avg. time" : "Pass rate"} value={a.passRate == null ? formatDuration(a.averageTime) : `${a.passRate}%`} icon="clock" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="mb-4 font-semibold">Score distribution</h2>
              <Histogram buckets={a.buckets} />
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">Hardest questions</h2>
              <p className="mb-4 text-xs text-subtle">% of students who got it right, lowest first.</p>
              <BarList items={hardest.slice(0, 6).map((q) => ({ id: q.id, label: `Q${q.number} · ${q.subject}`, value: q.pctCorrect, detail: `${q.correct}/${q.correct + q.wrong + q.skipped}` }))} />
            </section>
          </div>

          <section className="card mt-6 overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 font-semibold">Merit list</h2>
            <LeaderboardTable rows={board} />
          </section>

          <section className="card mt-6 overflow-x-auto">
            <h2 className="border-b border-line px-4 py-3 font-semibold">Question-wise analysis</h2>
            <table className="table">
              <thead>
                <tr><th className="w-10">#</th><th>Question</th><th className="text-right">Correct</th><th className="text-right">Wrong</th><th className="text-right">Skipped</th><th className="w-40">% right</th></tr>
              </thead>
              <tbody>
                {a.questions.map((q) => (
                  <tr key={q.id}>
                    <td className="text-muted tabular-nums">{q.number}</td>
                    <td className="max-w-md"><div className="rich line-clamp-2 text-sm" dangerouslySetInnerHTML={{ __html: snippet(q) }} /><div className="text-xs text-subtle">{q.subject}</div></td>
                    <td className="text-right tabular-nums">{q.correct}</td>
                    <td className="text-right tabular-nums">{q.wrong}</td>
                    <td className="text-right tabular-nums">{q.skipped}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent-hover" style={{ width: `${q.pctCorrect}%` }} /></div>
                        <span className="w-9 text-right text-xs font-semibold tabular-nums">{q.pctCorrect}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {mostSkipped.length > 0 && (
            <section className="card mt-6 p-5">
              <h2 className="mb-3 font-semibold">Most skipped</h2>
              <ul className="space-y-2">
                {mostSkipped.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="flex min-w-0 gap-2"><span className="text-muted">Q{q.number}</span><span className="rich line-clamp-1" dangerouslySetInnerHTML={{ __html: snippet(q) }} /></span>
                    <span className="shrink-0 font-semibold tabular-nums">{q.pctSkipped}% skipped</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** Results overview: one row per exam with headline numbers. */
export async function ResultsOverviewPage({ user, base }: { user: CurrentUser; base: string }) {
  const exams = await db.exam.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, marksPerQuestion: true, _count: { select: { questions: true } } },
  });
  const stats = await db.attempt.groupBy({
    by: ["examId"],
    where: { attemptNo: 1, status: "SUBMITTED", examId: { in: exams.map((e) => e.id) } },
    _count: { _all: true },
    _avg: { score: true, percentage: true },
    _max: { score: true },
  });
  const by = new Map(stats.map((s) => [s.examId, s]));
  return (
    <>
      <PageHeader title="Results" description={user.role === "ADMIN" ? "Results for every exam." : "Results for the exams you created."} />
      {exams.length === 0 ? (
        <EmptyState icon="chart" title="No exams yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Exam</th><th className="text-right">Submissions</th><th className="text-right">Average</th><th className="text-right">Highest</th><th /></tr></thead>
            <tbody>
              {exams.map((e) => {
                const s = by.get(e.id);
                return (
                  <tr key={e.id}>
                    <td className="font-medium">{e.title}</td>
                    <td className="text-right tabular-nums">{s?._count._all ?? 0}</td>
                    <td className="text-right tabular-nums">{s ? `${formatNumber(s._avg.score)} (${formatNumber(s._avg.percentage)}%)` : "—"}</td>
                    <td className="text-right tabular-nums">{s ? formatNumber(s._max.score) : "—"}</td>
                    <td className="text-right"><Link href={`${base}/exams/${e.id}/results`} className="text-sm font-semibold text-accent-text hover:underline">Analytics</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
