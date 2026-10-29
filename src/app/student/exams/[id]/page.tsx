import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { EXAM_TYPE_LABEL, finalizeExpiredAttempts, negativeRuleText, startEligibility, studentExamWhere, windowState, type ExamType } from "@/lib/exams";
import { formatDateTime, formatNumber } from "@/lib/format";
import { RichText } from "@/components/rich-text";
import { Alert, PageHeader } from "@/components/ui";
import { StartExamButton } from "@/features/student/start-exam-button";

export const metadata: Metadata = { title: "Exam instructions" };

export default async function ExamInstructionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const exam = await db.exam.findFirst({ where: { id, ...studentExamWhere(user) }, include: { _count: { select: { questions: true } } } });
  if (!exam) notFound();
  await finalizeExpiredAttempts({ examId: exam.id, userId: user.id });
  const eligibility = await startEligibility(exam, user.id);
  const state = windowState(exam);
  const total = exam._count.questions * exam.marksPerQuestion;
  const lastSubmitted = eligibility.attempts.find((a) => a.status === "SUBMITTED");

  const facts: [string, string][] = [
    ["Type", EXAM_TYPE_LABEL[exam.type as ExamType]],
    ["Questions", String(exam._count.questions)],
    ["Total marks", formatNumber(total)],
    ["Marks per question", formatNumber(exam.marksPerQuestion)],
    ["Duration", exam.durationMinutes ? `${exam.durationMinutes} minutes` : "Untimed"],
    ...(exam.passMark != null ? [["Pass mark", formatNumber(exam.passMark)] as [string, string]] : []),
    ...(exam.schedule === "LIVE" ? [["Window", `${formatDateTime(exam.startsAt)} – ${formatDateTime(exam.endsAt)}`] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={exam.title} actions={<Link href="/student/exams" className="btn btn-ghost">All exams</Link>} />
      <div className="card p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-subtle">{k}</dt>
              <dd className="mt-0.5 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${exam.negativeMarking ? "border-warning/40 bg-warning-soft text-warning" : "border-success/30 bg-success-soft text-success"}`}>
          {negativeRuleText(exam)}
          <span className="block text-xs font-normal opacity-90">Skipped questions are never penalised.</span>
        </div>

        <h2 className="mt-6 font-semibold">Instructions</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {exam.durationMinutes ? <li>The timer starts when you press Start and keeps running even if you close the page. The exam submits automatically when time runs out.</li> : <li>This exam is untimed. Submit when you are done.</li>}
          <li>Every answer is saved instantly. If your internet drops or the page reloads, open the exam again to continue where you left off.</li>
          <li>Use “Mark for review” to flag questions and come back to them from the question palette.</li>
          <li>{exam.schedule === "LIVE" || !exam.allowRetake ? "You can take this exam only once." : "You may retake this exam. Rankings use your first attempt."}</li>
        </ul>
        {exam.instructions && <RichText text={exam.instructions} className="mt-4 rounded-xl border border-line bg-surface-2 p-4 text-sm leading-relaxed" />}

        <div className="mt-6">
          {eligibility.ok ? (
            <StartExamButton examId={exam.id} resume={!!eligibility.resume} />
          ) : (
            <Alert tone={state === "UPCOMING" ? "info" : "warning"}>
              {eligibility.reason}
              {state === "UPCOMING" && ` It starts ${formatDateTime(exam.startsAt)}.`}
            </Alert>
          )}
          {lastSubmitted && (
            <Link href={`/student/results/${lastSubmitted.id}`} className="btn btn-secondary mt-3 w-full">View your result</Link>
          )}
        </div>
      </div>
    </div>
  );
}
