import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { isStrong, isWeak, studentOverview } from "@/lib/results";
import { BarList, TrendChart } from "@/components/charts";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "My Results" };

export default async function MyResultsPage() {
  const user = await requireRole("STUDENT");
  const { attempts, released, avg, best, breakdown } = await studentOverview(user.id);
  const weak = breakdown.subjects.filter(isWeak);
  const strong = breakdown.subjects.filter(isStrong);

  return (
    <>
      <PageHeader title="My Results" description="Every exam you have taken, with your progress over time." />
      {attempts.length === 0 ? (
        <EmptyState icon="file" title="No results yet">Take an exam and your score, rank and analysis will appear here.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Exams taken" value={attempts.length} icon="clipboard" />
            <StatCard label="Average score" value={avg == null ? "—" : `${formatNumber(avg)}%`} icon="chart" />
            <StatCard label="Best score" value={best == null ? "—" : `${formatNumber(best)}%`} icon="trophy" />
            <StatCard label="Weak subjects" value={weak.length} icon="book" hint={weak.map((w) => w.name).join(", ") || "None"} />
          </div>

          <section className="card mt-6 p-5">
            <h2 className="mb-4 font-semibold">Score trend</h2>
            <TrendChart points={released.map((a) => ({ label: a.exam.title, date: formatDate(a.submittedAt), value: a.percentage ?? 0 }))} />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="font-semibold">Subjects</h2>
              <p className="mb-4 text-xs text-subtle">
                {strong.length ? `Strong: ${strong.map((s) => s.name).join(", ")}. ` : ""}
                {weak.length ? `Needs work: ${weak.map((s) => s.name).join(", ")}.` : "Keep practising to find weak spots."}
              </p>
              <BarList items={breakdown.subjects.map((b) => ({ id: b.id, label: b.name, value: b.accuracy, detail: `${b.correct}/${b.total}`, flag: isWeak(b) ? "weak" : isStrong(b) ? "strong" : undefined }))} />
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">Weakest topics</h2>
              <p className="mb-4 text-xs text-subtle">Practise these first.</p>
              <BarList items={breakdown.topics.slice(0, 8).map((b) => ({ id: b.id, label: b.name, value: b.accuracy, detail: `${b.correct}/${b.total}`, flag: isWeak(b) ? "weak" : undefined }))} />
            </section>
          </div>

          <section className="card mt-6 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Exam</th><th>Date</th><th className="text-right">Score</th><th className="text-right">%</th><th /></tr>
              </thead>
              <tbody>
                {[...attempts].reverse().map((a) => {
                  const shown = released.includes(a);
                  return (
                    <tr key={a.id}>
                      <td className="font-medium">{a.exam.title}{a.attemptNo > 1 && <span className="ml-2 text-xs text-subtle">retake</span>}</td>
                      <td className="whitespace-nowrap text-muted">{formatDate(a.submittedAt)}</td>
                      <td className="text-right tabular-nums">{shown ? `${formatNumber(a.score)} / ${formatNumber(a.totalMarks)}` : "Pending"}</td>
                      <td className="text-right tabular-nums">{shown ? `${formatNumber(a.percentage)}%` : "—"}</td>
                      <td className="text-right"><Link href={`/student/results/${a.id}`} className="text-sm font-semibold text-accent-text hover:underline">Details</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
