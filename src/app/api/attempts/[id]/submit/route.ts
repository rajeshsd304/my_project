import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { loadOwnAttempt } from "@/lib/attempt-api";
import { submitAttempt } from "@/lib/exams";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiRole("STUDENT");
  if (error) return error;
  const { attempt, error: loadError } = await loadOwnAttempt(user, (await params).id);
  if (loadError) return loadError;
  const body = (await req.json().catch(() => ({}))) as { auto?: boolean };
  // Only a real timeout counts as auto-submitted; the server deadline decides that.
  const late = !!attempt.deadlineAt && Date.now() >= attempt.deadlineAt.getTime();
  await submitAttempt(attempt.id, { auto: late && !!body.auto });
  return NextResponse.json({ redirect: `/student/results/${attempt.id}` });
}
