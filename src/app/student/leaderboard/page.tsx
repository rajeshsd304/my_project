import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { resultsReleased, studentExamWhere } from "@/lib/exams";
import { formatNumber } from "@/lib/format";
import { examLeaderboard, overallLeaderboard, type OverallPeriod } from "@/lib/results";
import { getSettings } from "@/lib/settings";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Leaderboard" };

const PERIODS: [OverallPeriod, string][] = [["week", "This week"], ["month", "This month"], ["all", "All time"]];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ exam?: string; period?: string }> }) {
  const user = await requireRole("STUDENT");
  const sp = await searchParams;
  const settings = await getSettings();
  const exams = (
    await db.exam.findMany({
      where: { ...studentExamWhere(user), showLeaderboard: true, attempts: { some: { status: "SUBMITTED" } } },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, schedule: true, endsAt: true, resultRelease: true, leaderboardTopN: true },
    })
  ).filter((e) => resultsReleased(e));
  const exam = sp.exam ? exams.find((e) => e.id === sp.exam) : undefined;
  const period: OverallPeriod = PERIODS.some(([p]) => p === sp.period) ? (sp.period as OverallPeriod) : "week";

  return (
    <>
      <PageHeader title="Leaderboard" description="Higher score ranks first; ties are broken by less time taken." />
      <form className="mb-4 flex flex-wrap gap-2" action="/student/leaderboard">
        <select name="exam" defaultValue={exam?.id ?? ""} className="input w-auto max-w-full min-w-56" aria-label="Choose leaderboard">
          <option value="">Overall leaderboard</option>
          {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <button className="btn btn-secondary">Show</button>
      </form>

      {exam ? (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 font-semibold">{exam.title}</h2>
          <LeaderboardTable rows={await examLeaderboard(exam.id)} topN={exam.leaderboardTopN} viewerId={user.id} />
        </section>
      ) : sp.exam ? (
        <Alert tone="info">This exam&apos;s leaderboard is not available.</Alert>
      ) : !settings.overallLeaderboardEnabled ? (
        <Alert tone="info">The overall leaderboard is hidden. Choose an exam above to see its ranking.</Alert>
      ) : (
        <section className="card overflow-hidden">
          <nav className="flex gap-1 border-b border-line px-2" aria-label="Period">
            {PERIODS.map(([p, label]) => (
              <Link
                key={p}
                href={`/student/leaderboard?period=${p}`}
                aria-current={period === p ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold ${period === p ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <LeaderboardTable
            rows={(await overallLeaderboard(period)).map((r) => ({ ...r, extra: `${r.exams} · ${formatNumber(r.avgPercentage)}%` }))}
            topN={settings.overallLeaderboardTopN}
            viewerId={user.id}
            scoreLabel="Total score"
            extraLabel="Exams · avg"
          />
        </section>
      )}
    </>
  );
}
