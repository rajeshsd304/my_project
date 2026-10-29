import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import {
  DIFFICULTIES,
  LANGUAGES,
  MAX_OPTIONS,
  buildSearchText,
  clean,
  contentHash,
  encodeTags,
  parseTags,
  pick,
  type QuestionInput,
} from "./question-content";

const bi = z.object({ bn: z.string().max(5000).nullable().optional(), en: z.string().max(5000).nullable().optional() });

export const questionSchema = z.object({
  subjectId: z.string().min(1, "Choose a subject."),
  topicId: z.string().nullable().optional(),
  language: z.enum(LANGUAGES),
  text: bi,
  options: z.array(bi.extend({ isCorrect: z.boolean() })).min(2, "At least 2 options are required.").max(MAX_OPTIONS),
  explanation: bi.default({}),
  difficulty: z.enum(DIFFICULTIES).default("MEDIUM"),
  tags: z.array(z.string()).default([]),
  imageId: z.string().nullable().optional(),
});
export type QuestionPayload = z.infer<typeof questionSchema>;

export function toInput(p: QuestionPayload): QuestionInput {
  return {
    language: p.language,
    text: pick({ bn: p.text.bn ?? null, en: p.text.en ?? null }, p.language),
    options: p.options.map((o) => ({ ...pick({ bn: o.bn ?? null, en: o.en ?? null }, p.language), isCorrect: o.isCorrect })),
    explanation: pick({ bn: p.explanation.bn ?? null, en: p.explanation.en ?? null }, p.language),
    difficulty: p.difficulty,
    tags: parseTags(p.tags),
  };
}

/** Column values for a question row (options are written separately). */
export function questionFields(q: QuestionInput) {
  return {
    language: q.language,
    textBn: q.text.bn,
    textEn: q.text.en,
    explanationBn: clean(q.explanation.bn),
    explanationEn: clean(q.explanation.en),
    difficulty: q.difficulty,
    tags: encodeTags(q.tags),
    searchText: buildSearchText(q),
    contentHash: contentHash(q.text),
  };
}

export function optionRows(q: QuestionInput) {
  return q.options.map((o, i) => ({ sortOrder: i, textBn: o.bn, textEn: o.en, isCorrect: o.isCorrect }));
}

/** Topic must belong to the subject. Returns an error message or null. */
export async function checkPlacement(subjectId: string, topicId: string | null | undefined) {
  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return "Selected subject no longer exists.";
  if (topicId) {
    const topic = await db.topic.findUnique({ where: { id: topicId }, select: { subjectId: true } });
    if (!topic || topic.subjectId !== subjectId) return "Selected topic does not belong to this subject.";
  }
  return null;
}

export const canEditQuestion = (user: CurrentUser, q: { createdById: string | null }) =>
  user.role === "ADMIN" || q.createdById === user.id;

export type QuestionFilters = {
  q?: string;
  unitId?: string;
  subjectId?: string;
  topicId?: string;
  difficulty?: string;
  tag?: string;
  language?: string;
  mine?: boolean;
};

export function questionWhere(f: QuestionFilters, user: CurrentUser): Prisma.QuestionWhereInput {
  const terms = (f.q ?? "").normalize("NFC").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  const tag = parseTags(f.tag ?? "")[0];
  return {
    deletedAt: null,
    ...(f.subjectId ? { subjectId: f.subjectId } : f.unitId ? { subject: { unitId: f.unitId } } : {}),
    ...(f.topicId ? { topicId: f.topicId === "none" ? null : f.topicId } : {}),
    ...((DIFFICULTIES as readonly string[]).includes(f.difficulty ?? "") ? { difficulty: f.difficulty } : {}),
    ...((LANGUAGES as readonly string[]).includes(f.language ?? "") ? { language: f.language } : {}),
    ...(tag ? { tags: { contains: `,${tag},` } } : {}),
    ...(f.mine ? { createdById: user.id } : {}),
    ...(terms.length ? { AND: terms.map((t) => ({ searchText: { contains: t } })) } : {}),
  };
}

export const questionListSelect = {
  id: true,
  language: true,
  textBn: true,
  textEn: true,
  difficulty: true,
  tags: true,
  createdById: true,
  createdAt: true,
  imageId: true,
  subject: { select: { id: true, name: true, unit: { select: { id: true, name: true } } } },
  topic: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
  _count: { select: { options: true } },
} as const;

/**
 * Delete questions. Questions already used in an exam are archived (hidden from the bank)
 * so past exams and results stay intact; unused ones are removed.
 */
export async function deleteQuestions(ids: string[]) {
  const used = await questionsInUse(ids);
  const archive = ids.filter((id) => used.has(id));
  const remove = ids.filter((id) => !used.has(id));
  await db.$transaction([
    db.question.updateMany({ where: { id: { in: archive } }, data: { deletedAt: new Date() } }),
    db.question.deleteMany({ where: { id: { in: remove } } }),
  ]);
  return { archived: archive.length, deleted: remove.length };
}

export async function questionsInUse(ids: string[]): Promise<Set<string>> {
  const rows = await db.examQuestion.findMany({ where: { questionId: { in: ids } }, select: { questionId: true }, distinct: ["questionId"] });
  return new Set(rows.map((r) => r.questionId));
}
