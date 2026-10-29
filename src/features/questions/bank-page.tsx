import Link from "next/link";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { canEditQuestion, questionWhere } from "@/lib/questions";
import { decodeTags, type Difficulty, type Language } from "@/lib/question-content";
import { renderQuestion } from "@/lib/render-question";
import { getTaxonomy } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { BankFilters } from "./bank-filters";
import { BankList, type BankRow } from "./bank-list";

const PAGE_SIZE = 25;

export type BankSearchParams = {
  q?: string;
  unit?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  language?: string;
  tag?: string;
  mine?: string;
  page?: string;
};

export async function QuestionBankPage({ user, base, searchParams }: { user: CurrentUser; base: string; searchParams: BankSearchParams }) {
  const sp = searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = questionWhere(
    { q: sp.q, unitId: sp.unit, subjectId: sp.subject, topicId: sp.topic, difficulty: sp.difficulty, language: sp.language, tag: sp.tag, mine: sp.mine === "1" },
    user,
  );
  const [taxonomy, total, questions] = await Promise.all([
    getTaxonomy(),
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        options: { orderBy: { sortOrder: "asc" } },
        subject: { select: { name: true, unit: { select: { name: true } } } },
        topic: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const rows: BankRow[] = questions.map((q) => ({
    id: q.id,
    language: q.language as Language,
    difficulty: q.difficulty as Difficulty,
    tags: decodeTags(q.tags),
    place: [q.subject.unit.name, q.subject.name, q.topic?.name].filter(Boolean).join(" › "),
    author: q.createdBy?.name ?? "—",
    editable: canEditQuestion(user, q),
    view: renderQuestion(q, { explanation: true }),
    correct: q.options.filter((o) => o.isCorrect).map((o) => o.id),
  }));

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}/questions?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Question Bank"
        description={`${total} question${total === 1 ? "" : "s"}${user.role === "TEACHER" ? " · you can edit the ones you created" : ""}`}
        actions={
          <>
            {user.role === "ADMIN" && (
              <Link href={`${base}/questions/taxonomy`} className="btn btn-ghost"><Icon name="layers" className="size-4" /> Units & subjects</Link>
            )}
            <Link href={`${base}/questions/imports`} className="btn btn-ghost"><Icon name="clock" className="size-4" /> Import history</Link>
            <Link href={`${base}/questions/import`} className="btn btn-secondary"><Icon name="upload" className="size-4" /> Import</Link>
            <Link href={`${base}/questions/new`} className="btn btn-primary"><Icon name="plus" className="size-4" /> New question</Link>
          </>
        }
      />
      {taxonomy.length === 0 ? (
        <EmptyState icon="layers" title="Set up units and subjects first">
          {user.role === "ADMIN" ? (
            <Link href={`${base}/questions/taxonomy`} className="text-accent-text hover:underline">Create units, subjects and topics</Link>
          ) : (
            "Ask an admin to create units and subjects."
          )}
        </EmptyState>
      ) : (
        <>
          <BankFilters taxonomy={taxonomy} base={base} />
          {rows.length === 0 ? (
            <EmptyState icon="book" title="No questions found">Try different filters, or add a question.</EmptyState>
          ) : (
            <BankList rows={rows} taxonomy={taxonomy} />
          )}
          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
              {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn-secondary">Previous</Link> : <span />}
              <span className="text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className="btn btn-secondary">Next</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
