import "server-only";
import type { Exam, Prisma } from "@prisma/client";
import { db } from "./db";
import { finalizeExpiredAttempts, parseIds, resultsReleased, round2 } from "./exams";

/**
 * Rankings use each student's FIRST submitted attempt (retakes are practice).
 * Order: higher score first; ties broken by less time taken; identical score and time share a rank.
 */
const rankedOrder: Prisma.AttemptOrderByWithRelationInput[] = [{ score: "desc" }, { timeTakenSec: "asc" }, { submittedAt: "asc" }];

export type LeaderRow = {
  rank: number;
  userId: string;
  name: string;
  batch: string | null;
  score: number;
  percentage: number;
  timeTakenSec: number;
  attemptId: string;
};

function withRanks<T extends { score: number; timeTakenSec: number }>(rows: T[]): (T & { rank: number })[] {
  let rank = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.score !== r.score || prev.timeTakenSec !== r.timeTakenSec) rank = i + 1;
    return { ...r, rank };
  });
}

export async function examLeaderboard(examId: string): Promise<LeaderRow[]> {
  await finalizeExpiredAttempts({ examId });
  const attempts = await db.attempt.findMany({
    where: { examId, attemptNo: 1, status: "SUBMITTED" },
    orderBy: rankedOrder,
    select: { id: true, userId: true, score: true, percentage: true, timeTakenSec: true, user: { select: { name: true, batch: { select: { name: true } } } } },
  });
  return withRanks(
    attempts.map((a) => ({
      userId: a.userId,
      name: a.user.name,
      batch: a.user.batch?.name ?? null,
      score: a.score ?? 0,
      percentage: a.percentage ?? 0,
      timeTakenSec: a.timeTakenSec ?? 0,
      attemptId: a.id,
    })),
  );
}

/** Rank of an attempt within its exam (null for retakes, which are not ranked). */
export async function attemptRank(attempt: { id: string; examId: string; attemptNo: number }) {
  if (attempt.attemptNo !== 1) return null;
  const board = await examLeaderboard(attempt.examId);
  const row = board.find((r) => r.attemptId === attempt.id);
  return row ? { rank: row.rank, of: board.length } : null;
}

export type OverallPeriod = "week" | "month" | "all";

export async function overallLeaderboard(period: OverallPeriod) {
  const since = period === "week" ? new Date(Date.now() - 7 * 86400_000) : period === "month" ? new Date(Date.now() - 30 * 86400_000) : null;
  const now = new Date();
  const attempts = await db.attempt.findMany({
    where: {
      attemptNo: 1,
      status: "SUBMITTED",
      ...(since ? { submittedAt: { gte: since } } : {}),
      exam: { status: "PUBLISHED", showLeaderboard: true },
    },
    select: {
      userId: true,
      score: true,
      percentage: true,
      timeTakenSec: true,
      user: { select: { name: true, batch: { select: { name: true } } } },
      exam: { select: { schedule: true, endsAt: true, resultRelease: true } },
    },
  });
  const byUser = new Map<string, { userId: string; name: string; batch: string | null; score: number; timeTakenSec: number; exams: number; pctSum: number }>();
  for (const a of attempts) {
    if (!resultsReleased(a.exam, now)) continue;
    const row = byUser.get(a.userId) ?? { userId: a.userId, name: a.user.name, batch: a.user.batch?.name ?? null, score: 0, timeTakenSec: 0, exams: 0, pctSum: 0 };
    row.score += a.score ?? 0;
    row.timeTakenSec += a.timeTakenSec ?? 0;
    row.exams += 1;
    row.pctSum += a.percentage ?? 0;
    byUser.set(a.userId, row);
  }
  const rows = [...byUser.values()]
    .map((r) => ({ ...r, score: round2(r.score), avgPercentage: round2(r.pctSum / r.exams) }))
    .sort((a, b) => b.score - a.score || a.timeTakenSec - b.timeTakenSec);
  return withRanks(rows);
}

export type Breakdown = { id: string; name: string; total: number; correct: number; wrong: number; skipped: number; accuracy: number };

function tally(map: Map<string, Breakdown>, id: string, name: string, isCorrect: boolean | null) {
  const b = map.get(id) ?? { id, name, total: 0, correct: 0, wrong: 0, skipped: 0, accuracy: 0 };
  b.total++;
  if (isCorrect === true) b.correct++;
  else if (isCorrect === false) b.wrong++;
  else b.skipped++;
  b.accuracy = Math.round((b.correct / b.total) * 100);
  map.set(id, b);
}

/** Subject- and topic-wise performance for one or more attempts. */
export async function performanceBreakdown(attemptIds: string[]) {
  const answers = await db.attemptAnswer.findMany({
    where: { attemptId: { in: attemptIds } },
    select: { isCorrect: true, question: { select: { subject: { select: { id: true, name: true } }, topic: { select: { id: true, name: true } } } } },
  });
  const subjects = new Map<string, Breakdown>();
  const topics = new Map<string, Breakdown>();
  for (const a of answers) {
    tally(subjects, a.question.subject.id, a.question.subject.name, a.isCorrect);
    if (a.question.topic) tally(topics, a.question.topic.id, `${a.question.topic.name} · ${a.question.subject.name}`, a.isCorrect);
  }
  const sort = (m: Map<string, Breakdown>) => [...m.values()].sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
  return { subjects: sort(subjects), topics: sort(topics) };
}

/** Weak = below 50% accuracy (with at least 2 questions); strong = 75% or above. */
export const isWeak = (b: Breakdown) => b.total >= 2 && b.accuracy < 50;
export const isStrong = (b: Breakdown) => b.total >= 2 && b.accuracy >= 75;

export async function studentOverview(userId: string) {
  await finalizeExpiredAttempts({ userId });
  const now = new Date();
  const attempts = await db.attempt.findMany({
    where: { userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "asc" },
    include: { exam: { select: { id: true, title: true, schedule: true, endsAt: true, resultRelease: true, passMark: true } } },
  });
  const released = attempts.filter((a) => resultsReleased(a.exam, now));
  const avg = released.length ? round2(released.reduce((s, a) => s + (a.percentage ?? 0), 0) / released.length) : null;
  const best = released.length ? Math.max(...released.map((a) => a.percentage ?? 0)) : null;
  const breakdown = released.length ? await performanceBreakdown(released.map((a) => a.id)) : { subjects: [], topics: [] };
  return { attempts, released, avg, best, breakdown };
}

export async function examAnalytics(exam: Exam) {
  await finalizeExpiredAttempts({ examId: exam.id });
  const attempts = await db.attempt.findMany({
    where: { examId: exam.id, attemptNo: 1, status: "SUBMITTED" },
    select: { id: true, score: true, percentage: true, timeTakenSec: true },
  });
  const scores = attempts.map((a) => a.score ?? 0);
  const n = scores.length;

  // Score distribution in 10 percentage buckets (negative scores fall into the first bucket).
  const buckets = Array.from({ length: 10 }, (_, i) => ({ label: i === 0 ? "≤10%" : `${i * 10}–${i * 10 + 10}%`, count: 0 }));
  for (const a of attempts) buckets[Math.min(9, Math.max(0, Math.floor((a.percentage ?? 0) / 10)))].count++;

  const examQuestions = await db.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { sortOrder: "asc" },
    select: { question: { select: { id: true, textBn: true, textEn: true, difficulty: true, subject: { select: { name: true } } } } },
  });
  const answerStats = await db.attemptAnswer.groupBy({
    by: ["questionId", "isCorrect"],
    where: { attemptId: { in: attempts.map((a) => a.id) } },
    _count: { _all: true },
  });
  const per = new Map<string, { correct: number; wrong: number; skipped: number }>();
  for (const s of answerStats) {
    const row = per.get(s.questionId) ?? { correct: 0, wrong: 0, skipped: 0 };
    if (s.isCorrect === true) row.correct += s._count._all;
    else if (s.isCorrect === false) row.wrong += s._count._all;
    else row.skipped += s._count._all;
    per.set(s.questionId, row);
  }
  const questions = examQuestions.map(({ question: q }, i) => {
    const s = per.get(q.id) ?? { correct: 0, wrong: 0, skipped: 0 };
    const total = s.correct + s.wrong + s.skipped || 1;
    return {
      number: i + 1,
      id: q.id,
      textBn: q.textBn,
      textEn: q.textEn,
      difficulty: q.difficulty,
      subject: q.subject.name,
      ...s,
      pctCorrect: n ? Math.round((s.correct / total) * 100) : 0,
      pctSkipped: n ? Math.round((s.skipped / total) * 100) : 0,
    };
  });

  const passCount = exam.passMark != null ? scores.filter((s) => s >= exam.passMark!).length : null;
  return {
    count: n,
    average: n ? round2(scores.reduce((a, b) => a + b, 0) / n) : null,
    highest: n ? Math.max(...scores) : null,
    lowest: n ? Math.min(...scores) : null,
    averageTime: n ? Math.round(attempts.reduce((s, a) => s + (a.timeTakenSec ?? 0), 0) / n) : null,
    passRate: passCount != null && n ? Math.round((passCount / n) * 100) : null,
    buckets,
    questions,
    totalMarks: round2(examQuestions.length * exam.marksPerQuestion),
  };
}

/** Answer review rows for one attempt (only call after the review is released). */
export async function attemptReview(attemptId: string) {
  const attempt = await db.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
  const order = parseIds(attempt.questionOrder);
  const optionOrder: Record<string, string[]> = JSON.parse(attempt.optionOrder);
  const questions = await db.question.findMany({ where: { id: { in: order } }, include: { options: true, subject: { select: { name: true } }, topic: { select: { name: true } } } });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answers = new Map(attempt.answers.map((a) => [a.questionId, a]));
  return order.flatMap((qid) => {
    const q = byId.get(qid);
    if (!q) return [];
    const opts = new Map(q.options.map((o) => [o.id, o]));
    const options = (optionOrder[qid] ?? []).flatMap((id) => (opts.has(id) ? [opts.get(id)!] : []));
    const a = answers.get(qid);
    return [{ question: { ...q, options }, selected: a ? parseIds(a.selected) : [], isCorrect: a?.isCorrect ?? null, marks: a?.marks ?? 0 }];
  });
}
