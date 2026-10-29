import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { deleteQuestions } from "@/lib/questions";
import { UNDO_WINDOW_MS } from "@/lib/question-import";



/** Undo an import within 24 hours: removes its questions (archiving any already used in exams). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  const { id } = await params;
  const imp = await db.questionImport.findUnique({ where: { id } });
  if (!imp) return jsonError("Import not found.", 404);
  if (user.role !== "ADMIN" && imp.createdById !== user.id) return jsonError("You can only undo your own imports.", 403);
  if (imp.undoneAt) return jsonError("This import has already been undone.");
  if (Date.now() - imp.createdAt.getTime() > UNDO_WINDOW_MS) return jsonError("Imports can only be undone within 24 hours.");

  const questions = await db.question.findMany({ where: { importId: id, deletedAt: null }, select: { id: true } });
  const result = await deleteQuestions(questions.map((q) => q.id));
  await db.questionImport.update({ where: { id }, data: { undoneAt: new Date() } });
  return NextResponse.json(result);
}
