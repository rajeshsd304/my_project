import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { loadOwnAttempt } from "@/lib/attempt-api";
import { finalizeExpiredAttempts } from "@/lib/exams";

/** Timer re-sync: server time + deadline (no question content, no answers' correctness). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiRole("STUDENT");
  if (error) return error;
  const { attempt, error: loadError } = await loadOwnAttempt(user, (await params).id);
  if (loadError) return loadError;
  if (attempt.status === "IN_PROGRESS") await finalizeExpiredAttempts({ id: attempt.id });
  const { attempt: fresh } = await loadOwnAttempt(user, attempt.id);
  return NextResponse.json({ status: fresh!.status, deadlineAt: fresh!.deadlineAt, serverNow: new Date() });
}
