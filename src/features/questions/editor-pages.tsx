import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { canEditQuestion } from "@/lib/questions";
import { decodeTags, type Difficulty, type Language } from "@/lib/question-content";
import { getTaxonomy } from "@/lib/taxonomy";
import { Alert, PageHeader } from "@/components/ui";
import { QuestionEditor } from "./question-editor";

export async function NewQuestionPage({ base }: { base: string }) {
  const taxonomy = await getTaxonomy();
  return (
    <>
      <PageHeader title="New question" actions={<Link href={`${base}/questions`} className="btn btn-ghost">Back to bank</Link>} />
      {taxonomy.length ? <QuestionEditor taxonomy={taxonomy} base={base} /> : <Alert tone="warning">Create a unit and subject first.</Alert>}
    </>
  );
}

export async function EditQuestionPage({ user, base, id }: { user: CurrentUser; base: string; id: string }) {
  const [taxonomy, q] = await Promise.all([
    getTaxonomy(),
    db.question.findFirst({
      where: { id, deletedAt: null },
      include: { options: { orderBy: { sortOrder: "asc" } }, subject: { select: { unitId: true } } },
    }),
  ]);
  if (!q) notFound();
  if (!canEditQuestion(user, q)) {
    return (
      <>
        <PageHeader title="Edit question" />
        <Alert tone="error">You can only edit questions you created.</Alert>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Edit question" actions={<Link href={`${base}/questions`} className="btn btn-ghost">Back to bank</Link>} />
      <QuestionEditor
        taxonomy={taxonomy}
        base={base}
        initial={{
          id: q.id,
          unitId: q.subject.unitId,
          subjectId: q.subjectId,
          topicId: q.topicId,
          language: q.language as Language,
          text: { bn: q.textBn ?? "", en: q.textEn ?? "" },
          options: q.options.map((o) => ({ bn: o.textBn ?? "", en: o.textEn ?? "", isCorrect: o.isCorrect })),
          explanation: { bn: q.explanationBn ?? "", en: q.explanationEn ?? "" },
          difficulty: q.difficulty as Difficulty,
          tags: decodeTags(q.tags),
          imageId: q.imageId,
        }}
      />
    </>
  );
}
