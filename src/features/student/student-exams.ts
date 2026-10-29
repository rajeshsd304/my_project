import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { finalizeExpiredAttempts, studentExamWhere, windowState, type WindowState } from "@/lib/exams";

export type StudentExamItem = {
  id: string;
  title: string;
  type: string;
  durationMinutes: number | null;
  questionCount: number;
  totalMarks: number;
  negativeMarking: boolean;
  negativeMark: number;
  state: WindowState;
  startsAt: Date | null;
  endsAt: Date | null;
  inProgressId: string | null;
  lastSubmittedId: string | null;
  attempts: number;
  canStart: boolean;
};

/** Every exam visible to the student, with their attempt state. */
export async function getStudentExams(user: CurrentUser): Promise<StudentExamItem[]> {
  await finalizeExpiredAttempts({ userId: user.id });
  const exams = await db.exam.findMany({
    where: studentExamWhere(user),
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { questions: true } },
      attempts: { where: { userId: user.id }, orderBy: { attemptNo: "desc" }, select: { id: true, status: true } },
    },
  });
  return exams.map((e) => {
    const state = windowState(e);
    const inProgress = e.attempts.find((a) => a.status === "IN_PROGRESS");
    const submitted = e.attempts.filter((a) => a.status === "SUBMITTED");
    const open = state === "ALWAYS" || state === "LIVE";
    const canStart = !!inProgress || (open && (submitted.length === 0 || (e.schedule !== "LIVE" && e.allowRetake)));
    return {
      id: e.id,
      title: e.title,
      type: e.type,
      durationMinutes: e.durationMinutes,
      questionCount: e._count.questions,
      totalMarks: +(e._count.questions * e.marksPerQuestion).toFixed(2),
      negativeMarking: e.negativeMarking,
      negativeMark: e.negativeMark,
      state,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      inProgressId: inProgress?.id ?? null,
      lastSubmittedId: submitted[0]?.id ?? null,
      attempts: submitted.length,
      canStart,
    };
  });
}
