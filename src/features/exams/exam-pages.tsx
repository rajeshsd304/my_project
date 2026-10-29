import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { canManageExam, EXAM_TYPE_LABEL, negativeRuleText, windowState, type ExamType } from "@/lib/exams";
import { formatDateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { getTaxonomy } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";
import { Alert, EmptyState, PageHeader } from "@/components/ui";
import { ExamActions } from "./exam-actions";
import { ExamQuestions } from "./exam-questions";
import { ExamSettingsForm, type ExamFormValues } from "./exam-settings-form";

export function ExamStatusBadge({ exam }: { exam: { status: string; schedule: string; startsAt: Date | null; endsAt: Date | null } }) {
  if (exam.status !== "PUBLISHED") return <span className="badge border-line-strong text-muted">Draft</span>;
  const state = windowState(exam);
  const style = { ALWAYS: "border-success/40 text-success", LIVE: "border-danger/40 bg-danger-soft text-danger", UPCOMING: "border-accent/40 text-accent-text", ENDED: "border-line-strong text-subtle" }[state];
  const label = { ALWAYS: "Published", LIVE: "Live now", UPCOMING: "Upcoming", ENDED: "Ended" }[state];
  return <span className={`badge ${style}`}>{label}</span>;
}

export async function ExamsListPage({ user, base }: { user: CurrentUser; base: string }) {
  const exams = await db.exam.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
      createdBy: { select: { name: true } },
      attempts: { where: { status: "SUBMITTED" }, select: { id: true } },
    },
  });
  const started = await db.attempt.groupBy({ by: ["examId"], _count: { _all: true }, where: { examId: { in: exams.map((e) => e.id) } } });
  const startedBy = new Map(started.map((s) => [s.examId, s._count._all]));

  return (
    <>
      <PageHeader
        title={user.role === "ADMIN" ? "Exams" : "My Exams"}
        description="Create mock tests, quizzes and practice sets."
        actions={<Link href={`${base}/exams/new`} className="btn btn-primary"><Icon name="plus" className="size-4" /> New exam</Link>}
      />
      {exams.length === 0 ? (
        <EmptyState icon="clipboard" title="No exams yet">Create your first exam, then add questions from the bank.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {exams.map((e) => (
            <li key={e.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`${base}/exams/${e.id}`} className="font-semibold hover:text-accent-text">{e.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <ExamStatusBadge exam={e} />
                    <span className="badge border-line-strong">{EXAM_TYPE_LABEL[e.type as ExamType]}</span>
                    <span>{e._count.questions} questions</span>
                    <span>· {e.durationMinutes ? `${e.durationMinutes} min` : "Untimed"}</span>
                    <span>· {negativeRuleText(e)}</span>
                    {e.schedule === "LIVE" && <span>· {formatDateTime(e.startsAt)} → {formatDateTime(e.endsAt)}</span>}
                    {user.role === "ADMIN" && e.createdBy && <span>· by {e.createdBy.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`${base}/exams/${e.id}/results`} className="btn btn-secondary min-h-9 py-1.5 text-xs">
                    <Icon name="chart" className="size-4" /> Results ({e.attempts.length})
                  </Link>
                  <Link href={`${base}/exams/${e.id}`} className="btn btn-ghost min-h-9 py-1.5 text-xs">Edit</Link>
                  <ExamActions examId={e.id} base={base} canDelete={!startedBy.get(e.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function formOptions() {
  const [units, batches] = await Promise.all([
    db.unit.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.batch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { units, batches };
}

export async function NewExamPage({ base }: { base: string }) {
  const [{ units, batches }, settings] = await Promise.all([formOptions(), getSettings()]);
  const initial: ExamFormValues = {
    title: "",
    type: "FULL_MOCK",
    unitId: "",
    instructions: "",
    durationMinutes: "60",
    marksPerQuestion: "1",
    passMark: "",
    negativeMarking: settings.defaultNegativeMarking,
    negativeMark: settings.defaultNegativeMark.toFixed(2),
    shuffleQuestions: true,
    shuffleOptions: false,
    showExplanations: true,
    allowRetake: false,
    schedule: "ALWAYS",
    startsAt: "",
    endsAt: "",
    resultRelease: "IMMEDIATE",
    audience: "ALL",
    batchIds: [],
    status: "DRAFT",
    showLeaderboard: true,
    leaderboardTopN: "",
  };
  return (
    <>
      <PageHeader title="New exam" actions={<Link href={`${base}/exams`} className="btn btn-ghost">Back to exams</Link>} />
      <ExamSettingsForm initial={initial} units={units} batches={batches} base={base} locked={false} questionCount={0} />
    </>
  );
}

export async function EditExamPage({ user, base, id, tab }: { user: CurrentUser; base: string; id: string; tab?: string }) {
  const exam = await db.exam.findUnique({
    where: { id },
    include: {
      batches: { select: { batchId: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { question: { select: { id: true, textBn: true, textEn: true, difficulty: true, deletedAt: true, subject: { select: { name: true } }, topic: { select: { name: true } } } } },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) notFound();
  if (!canManageExam(user, exam)) {
    return (
      <>
        <PageHeader title="Exam" />
        <Alert tone="error">You can only manage exams you created.</Alert>
      </>
    );
  }
  const [{ units, batches }, taxonomy] = await Promise.all([formOptions(), getTaxonomy()]);
  const locked = exam._count.attempts > 0;
  const current = tab === "questions" ? "questions" : "settings";
  const initial: ExamFormValues = {
    title: exam.title,
    type: exam.type as ExamFormValues["type"],
    unitId: exam.unitId ?? "",
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes ? String(exam.durationMinutes) : "",
    marksPerQuestion: String(exam.marksPerQuestion),
    passMark: exam.passMark == null ? "" : String(exam.passMark),
    negativeMarking: exam.negativeMarking,
    negativeMark: exam.negativeMarking ? exam.negativeMark.toFixed(2) : "0.25",
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    showExplanations: exam.showExplanations,
    allowRetake: exam.allowRetake,
    schedule: exam.schedule as ExamFormValues["schedule"],
    startsAt: "",
    endsAt: "",
    resultRelease: exam.resultRelease as ExamFormValues["resultRelease"],
    audience: exam.audience as ExamFormValues["audience"],
    batchIds: exam.batches.map((b) => b.batchId),
    status: exam.status as ExamFormValues["status"],
    showLeaderboard: exam.showLeaderboard,
    leaderboardTopN: exam.leaderboardTopN ? String(exam.leaderboardTopN) : "",
  };

  return (
    <>
      <PageHeader
        title={exam.title}
        description={`${EXAM_TYPE_LABEL[exam.type as ExamType]} · ${exam.questions.length} questions · ${negativeRuleText(exam)}`}
        actions={
          <>
            <a href={`/api/exams/${exam.id}/pdf?kind=paper`} className="btn btn-ghost"><Icon name="download" className="size-4" /> Question paper</a>
            <a href={`/api/exams/${exam.id}/pdf?kind=key`} className="btn btn-ghost"><Icon name="download" className="size-4" /> Answer key</a>
            <Link href={`${base}/exams/${exam.id}/results`} className="btn btn-secondary"><Icon name="chart" className="size-4" /> Results</Link>
          </>
        }
      />
      <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Exam sections">
        {[["settings", "Settings"], ["questions", `Questions (${exam.questions.length})`]].map(([key, label]) => (
          <Link
            key={key}
            href={`${base}/exams/${exam.id}${key === "questions" ? "?tab=questions" : ""}`}
            aria-current={current === key ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${current === key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {current === "settings" ? (
        <ExamSettingsForm
          examId={exam.id}
          initial={initial}
          startsAtIso={exam.startsAt?.toISOString() ?? null}
          endsAtIso={exam.endsAt?.toISOString() ?? null}
          units={units}
          batches={batches}
          base={base}
          locked={locked}
          questionCount={exam.questions.length}
        />
      ) : (
        <ExamQuestions
          examId={exam.id}
          locked={locked}
          taxonomy={taxonomy}
          marksPerQuestion={exam.marksPerQuestion}
          initial={exam.questions.map(({ question: q }) => ({
            id: q.id,
            textBn: q.textBn,
            textEn: q.textEn,
            difficulty: q.difficulty,
            place: [q.subject.name, q.topic?.name].filter(Boolean).join(" › "),
            archived: !!q.deletedAt,
          }))}
        />
      )}
    </>
  );
}

