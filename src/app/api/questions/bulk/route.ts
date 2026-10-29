import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { DIFFICULTIES } from "@/lib/question-content";
import { deleteQuestions } from "@/lib/questions";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete"), ids: z.array(z.string()).min(1).max(1000) }),
  z.object({ action: z.literal("topic"), ids: z.array(z.string()).min(1).max(1000), topicId: z.string() }),
  z.object({ action: z.literal("difficulty"), ids: z.array(z.string()).min(1).max(1000), difficulty: z.enum(DIFFICULTIES) }),
]);

/** Bulk delete / change topic / change difficulty. Teachers only affect their own questions. */
export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const editable = await db.question.findMany({
    where: { id: { in: data.ids }, deletedAt: null, ...(user.role === "ADMIN" ? {} : { createdById: user.id }) },
    select: { id: true },
  });
  const ids = editable.map((q) => q.id);
  const skipped = data.ids.length - ids.length;
  if (!ids.length) return jsonError("None of the selected questions can be changed by you.", 403);

  if (data.action === "delete") return NextResponse.json({ ...(await deleteQuestions(ids)), skipped });
  if (data.action === "difficulty") {
    const res = await db.question.updateMany({ where: { id: { in: ids } }, data: { difficulty: data.difficulty } });
    return NextResponse.json({ updated: res.count, skipped });
  }
  // Moving to a topic also moves the question to that topic's subject.
  const topic = await db.topic.findUnique({ where: { id: data.topicId }, select: { id: true, subjectId: true } });
  if (!topic) return jsonError("Topic not found.", 404);
  const res = await db.question.updateMany({ where: { id: { in: ids } }, data: { topicId: topic.id, subjectId: topic.subjectId } });
  return NextResponse.json({ updated: res.count, skipped });
}
