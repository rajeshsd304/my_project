import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { canManageExam } from "./exams";
import { jsonError } from "./api";

/** Load an exam the user may manage, or an error response. */
export async function loadManagedExam(user: CurrentUser, id: string) {
  const exam = await db.exam.findUnique({ where: { id } });
  if (!exam) return { error: jsonError("Exam not found.", 404) };
  if (!canManageExam(user, exam)) return { error: jsonError("You can only manage exams you created.", 403) };
  return { exam };
}
