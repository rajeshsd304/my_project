import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { isWeak, studentOverview } from "@/lib/results";
import { TrendChart } from "@/components/charts";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { AnnouncementCard } from "@/features/content/announcement-card";
import { StudentExamCard } from "@/features/student/exam-card";
import { getStudentExams } from "@/features/student/student-exams";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboard() {
  const user = await requireRole("STUDENT");
  const [batch, exams, overview, announcements] = await Promise.all([
    user.batchId ? db.batch.findUnique({ where: { id: user.batchId }, select: { name: true } }) : null,
    getStudentExams(user),
    studentOverview(user.id),
    db.announcement.findMany({
      where: { OR: [{ batchId: null }, ...(user.batchId ? [{ batchId: user.batchId }] : [])] },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 3,
      include: { batch: { select: { name: true } } },
    }),
  ]);
  const actionable = exams.filter((e) => e.inProgressId || e.canStart || e.state === "UPCOMING");
  const ordered = [...actionable].sort((a, b) => Number(!!b.inProgressId) - Number(!!a.inProgressId) || Number(b.state === "LIVE") - Number(a.state === "LIVE"));
  const weak = overview.breakdown.subjects.filter(isWeak);

  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} description={batch ? `Batch: ${batch.name}` : "You are not in a batch yet."} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Exams taken" value={overview.attempts.length} icon="clipboard" />
        <StatCard label="Average score" value={overview.avg == null ? "—" : `${formatNumber(overview.avg)}%`} icon="chart" />
        <StatCard label="Best score" value={overview.best == null ? "—" : `${formatNumber(overview.best)}%`} icon="trophy" />
        <StatCard label="Available now" value={actionable.filter((e) => e.canStart).length} icon="clock" hint={`${exams.filter((e) => e.state === "UPCOMING").length} upcoming`} />
      </div>

      {announcements.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Announcements</h2>
            <Link href="/student/announcements" className="text-sm font-medium text-accent-text hover:underline">View all</Link>
          </div>
          <div className="space-y-3">{announcements.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Your exams</h2>
          <Link href="/student/exams" className="text-sm font-medium text-accent-text hover:underline">All exams</Link>
        </div>
        {ordered.length ? (
          <ul className="grid gap-3 md:grid-cols-2">{ordered.slice(0, 4).map((e) => <StudentExamCard key={e.id} exam={e} />)}</ul>
        ) : (
          <EmptyState icon="clipboard" title="No exams right now">When your coaching center publishes a mock exam for your batch, it will show up here.</EmptyState>
        )}
      </section>

      {overview.released.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="card p-5">
            <h2 className="mb-4 font-semibold">Score trend</h2>
            <TrendChart points={overview.released.map((a) => ({ label: a.exam.title, date: formatDate(a.submittedAt), value: a.percentage ?? 0 }))} />
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Focus areas</h2>
            {weak.length ? (
              <ul className="space-y-2 text-sm">
                {weak.slice(0, 5).map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3">
                    <span>{w.name}</span>
                    <span className="badge border-warning/40 text-warning">{w.accuracy}% · Weak</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No weak subjects so far. Keep it up!</p>
            )}
            <Link href="/student/results" className="btn btn-secondary mt-4 w-full">Full analysis</Link>
          </section>
        </div>
      )}
    </>
  );
}
