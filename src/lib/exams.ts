import "server-only";
import { z } from "zod";
import type { Exam, Prisma } from "@prisma/client";
import { db } from "./db";
import type { CurrentUser } from "./auth";

export const EXAM_TYPES = ["FULL_MOCK", "SUBJECT", "TOPIC", "PRACTICE"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];
export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  FULL_MOCK: "Full mock",
  SUBJECT: "Subject test",
  TOPIC: "Topic quiz",
  PRACTICE: "Practice (untimed)",
};

/** Answers saved up to this long after the deadline are accepted (network latency). */
export const SAVE_GRACE_MS = 20_000;

const optionalDate = z
  .string()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid date." });
      return z.NEVER;
    }
    return d;
  });

export const examSettingsSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(150),
  type: z.enum(EXAM_TYPES),
  unitId: z.string().nullable().optional(),
  instructions: z.string().max(5000).default(""),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute.").max(600).nullable().optional(),
  marksPerQuestion: z.number().positive("Marks per question must be more than 0.").max(100),
  passMark: z.number().min(0).nullable().optional(),
  negativeMarking: z.boolean(),
  negativeMark: z.number().min(0).max(100),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  showExplanations: z.boolean(),
  allowRetake: z.boolean(),
  schedule: z.enum(["LIVE", "ALWAYS"]),
  startsAt: optionalDate,
  endsAt: optionalDate,
  resultRelease: z.enum(["IMMEDIATE", "AFTER_END"]),
  audience: z.enum(["ALL", "BATCHES"]),
  batchIds: z.array(z.string()).default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  showLeaderboard: z.boolean(),
  leaderboardTopN: z.number().int().min(1).max(10000).nullable().optional(),
});
export type ExamSettings = z.infer<typeof examSettingsSchema>;

/** Business rules on top of the schema. Returns an error message or null. */
export function checkExamSettings(s: ExamSettings): string | null {
  if (s.type !== "PRACTICE" && !s.durationMinutes) return "Set a duration (only Practice exams are untimed).";
  if (s.negativeMarking && !(s.negativeMark > 0)) return "Set the deduction per wrong answer, or turn negative marking off.";
  if (s.schedule === "LIVE") {
    if (!s.startsAt || !s.endsAt) return "A live exam needs a start and an end time.";
    if (s.endsAt <= s.startsAt) return "The end time must be after the start time.";
  }
  if (s.audience === "BATCHES" && !s.batchIds.length) return "Choose at least one batch, or assign the exam to everyone.";
  return null;
}

/** Normalised column values from settings. */
export function examFields(s: ExamSettings) {
  const live = s.schedule === "LIVE";
  return {
    title: s.title,
    type: s.type,
    unitId: s.unitId || null,
    instructions: s.instructions.trim(),
    durationMinutes: s.type === "PRACTICE" ? null : (s.durationMinutes ?? null),
    marksPerQuestion: s.marksPerQuestion,
    passMark: s.passMark ?? null,
    negativeMarking: s.negativeMarking,
    negativeMark: s.negativeMarking ? round2(s.negativeMark) : 0,
    shuffleQuestions: s.shuffleQuestions,
    shuffleOptions: s.shuffleOptions,
    showExplanations: s.showExplanations,
    // One attempt per live exam.
    allowRetake: live ? false : s.allowRetake,
    schedule: s.schedule,
    startsAt: live ? s.startsAt : null,
    endsAt: live ? s.endsAt : null,
    resultRelease: live ? s.resultRelease : "IMMEDIATE",
    audience: s.audience,
    status: s.status,
    showLeaderboard: s.showLeaderboard,
    leaderboardTopN: s.leaderboardTopN ?? null,
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const canManageExam = (user: CurrentUser, exam: { createdById: string | null }) =>
  user.role === "ADMIN" || exam.createdById === user.id;

export async function examHasAttempts(examId: string) {
  return (await db.attempt.count({ where: { examId } })) > 0;
}

/** Exams a student is allowed to see (published + assigned to everyone or to their batch). */
export function studentExamWhere(user: { batchId: string | null }): Prisma.ExamWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ audience: "ALL" }, ...(user.batchId ? [{ audience: "BATCHES", batches: { some: { batchId: user.batchId } } }] : [])],
  };
}

export type WindowState = "ALWAYS" | "UPCOMING" | "LIVE" | "ENDED";

export function windowState(exam: Pick<Exam, "schedule" | "startsAt" | "endsAt">, now = new Date()): WindowState {
  if (exam.schedule !== "LIVE") return "ALWAYS";
  if (exam.startsAt && now < exam.startsAt) return "UPCOMING";
  if (exam.endsAt && now >= exam.endsAt) return "ENDED";
  return "LIVE";
}

/** Score visible to the student? */
export function resultsReleased(exam: Pick<Exam, "schedule" | "endsAt" | "resultRelease">, now = new Date()) {
  if (exam.schedule !== "LIVE" || exam.resultRelease === "IMMEDIATE") return true;
  return !!exam.endsAt && now >= exam.endsAt;
}

/**
 * Correct answers / review visible? For live exams the answer key stays hidden until the
 * window closes, so early finishers can't pass answers to students still writing.
 */
export function reviewReleased(exam: Pick<Exam, "schedule" | "endsAt" | "resultRelease">, now = new Date()) {
  if (exam.schedule !== "LIVE") return true;
  return !!exam.endsAt && now >= exam.endsAt;
}

export function negativeRuleText(exam: Pick<Exam, "negativeMarking" | "negativeMark">) {
  return exam.negativeMarking ? `Negative marking: ${exam.negativeMark.toFixed(2)} per wrong answer` : "No negative marking";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Fix the question and option order for a new attempt, and its server-side deadline. */
export async function buildAttemptLayout(exam: Exam, now = new Date()) {
  const items = await db.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { sortOrder: "asc" },
    select: { questionId: true, question: { select: { options: { orderBy: { sortOrder: "asc" }, select: { id: true } } } } },
  });
  const ordered = exam.shuffleQuestions ? shuffle(items) : items;
  const optionOrder: Record<string, string[]> = {};
  for (const it of ordered) {
    const ids = it.question.options.map((o) => o.id);
    optionOrder[it.questionId] = exam.shuffleOptions ? shuffle(ids) : ids;
  }
  let deadline: Date | null = exam.durationMinutes ? new Date(now.getTime() + exam.durationMinutes * 60_000) : null;
  if (exam.schedule === "LIVE" && exam.endsAt && (!deadline || exam.endsAt < deadline)) deadline = exam.endsAt;
  return { questionOrder: ordered.map((i) => i.questionId), optionOrder, deadline };
}

export const parseIds = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Score and close an attempt. Idempotent: returns false if it was already submitted.
 * An answer is correct only when the selected set equals the correct set; skipped answers
 * never lose marks; wrong answers lose `negativeMark` when negative marking is on.
 */
export async function submitAttempt(attemptId: string, opts: { auto?: boolean; at?: Date } = {}) {
  return db.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUnique({ where: { id: attemptId }, include: { exam: true, answers: true } });
    if (!attempt || attempt.status !== "IN_PROGRESS") return false;
    const exam = attempt.exam;
    const order = parseIds(attempt.questionOrder);
    const correctOptions = await tx.questionOption.findMany({
      where: { questionId: { in: order }, isCorrect: true },
      select: { id: true, questionId: true },
    });
    const correctBy = new Map<string, Set<string>>();
    for (const o of correctOptions) {
      if (!correctBy.has(o.questionId)) correctBy.set(o.questionId, new Set());
      correctBy.get(o.questionId)!.add(o.id);
    }
    const answers = new Map(attempt.answers.map((a) => [a.questionId, a]));

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let negativeTotal = 0;
    for (const qid of order) {
      const a = answers.get(qid);
      const selected = a ? parseIds(a.selected) : [];
      const right = correctBy.get(qid) ?? new Set<string>();
      let isCorrect: boolean | null = null;
      let marks = 0;
      if (selected.length === 0) {
        skipped++;
      } else if (selected.length === right.size && selected.every((id) => right.has(id))) {
        correct++;
        isCorrect = true;
        marks = exam.marksPerQuestion;
      } else {
        wrong++;
        isCorrect = false;
        marks = exam.negativeMarking ? -exam.negativeMark : 0;
        negativeTotal += exam.negativeMarking ? exam.negativeMark : 0;
      }
      if (a) await tx.attemptAnswer.update({ where: { id: a.id }, data: { isCorrect, marks } });
      else await tx.attemptAnswer.create({ data: { attemptId, questionId: qid, selected: "[]", isCorrect, marks } });
    }

    const now = opts.at ?? new Date();
    const submittedAt = attempt.deadlineAt && now > attempt.deadlineAt ? attempt.deadlineAt : now;
    const totalMarks = round2(order.length * exam.marksPerQuestion);
    const score = round2(correct * exam.marksPerQuestion - negativeTotal);
    const res = await tx.attempt.updateMany({
      where: { id: attemptId, status: "IN_PROGRESS" },
      data: {
        status: "SUBMITTED",
        submittedAt,
        autoSubmitted: !!opts.auto,
        correct,
        wrong,
        skipped,
        negativeTotal: round2(negativeTotal),
        totalMarks,
        score,
        percentage: totalMarks > 0 ? round2((score / totalMarks) * 100) : 0,
        timeTakenSec: Math.max(0, Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)),
      },
    });
    return res.count === 1;
  });
}

/** Auto-submit attempts whose server deadline (plus grace) has passed. Called lazily on reads. */
export async function finalizeExpiredAttempts(where: Prisma.AttemptWhereInput = {}) {
  const cutoff = new Date(Date.now() - SAVE_GRACE_MS);
  const expired = await db.attempt.findMany({
    where: { ...where, status: "IN_PROGRESS", deadlineAt: { lt: cutoff } },
    select: { id: true, deadlineAt: true },
    take: 500,
  });
  for (const a of expired) await submitAttempt(a.id, { auto: true, at: a.deadlineAt! });
  return expired.length;
}

/** Can this student start (or resume) the exam now? */
export async function startEligibility(exam: Exam, userId: string, now = new Date()) {
  const state = windowState(exam, now);
  const attempts = await db.attempt.findMany({ where: { examId: exam.id, userId }, orderBy: { attemptNo: "desc" } });
  const inProgress = attempts.find((a) => a.status === "IN_PROGRESS" && (!a.deadlineAt || a.deadlineAt.getTime() + SAVE_GRACE_MS > now.getTime()));
  const submitted = attempts.filter((a) => a.status === "SUBMITTED");
  if (inProgress) return { ok: true as const, resume: inProgress, attempts };
  if (state === "UPCOMING") return { ok: false as const, reason: "This exam has not started yet.", attempts };
  if (state === "ENDED") return { ok: false as const, reason: "This exam has ended.", attempts };
  if (submitted.length && (exam.schedule === "LIVE" || !exam.allowRetake)) {
    return { ok: false as const, reason: "You have already taken this exam.", attempts };
  }
  return { ok: true as const, resume: null, attempts };
}

export function formatDuration(sec: number | null | undefined) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}
