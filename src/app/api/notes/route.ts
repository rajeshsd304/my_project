import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { noteSchema } from "@/lib/content-schemas";

/** Notes are readable by every logged-in user; only staff can add them. */
export async function GET() {
  const { error } = await requireApiRole("ADMIN", "TEACHER", "STUDENT");
  if (error) return error;
  const notes = await db.studyNote.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, description: true, kind: true, fileId: true, createdAt: true, subject: { select: { name: true, unit: { select: { name: true } } } } },
  });
  return NextResponse.json({ notes });
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { data, error } = await parseBody(req, noteSchema);
  if (error) return error;
  if (!(await db.subject.count({ where: { id: data.subjectId } }))) return jsonError("Subject not found.", 404);
  if (data.kind === "PDF") {
    const file = await db.storedFile.findUnique({ where: { id: data.fileId! } });
    if (!file || file.mime !== "application/pdf") return jsonError("Upload a PDF file.");
  }
  const note = await db.studyNote.create({
    data: {
      title: data.title,
      description: data.description || null,
      subjectId: data.subjectId,
      kind: data.kind,
      body: data.kind === "TEXT" ? data.body!.trim() : null,
      fileId: data.kind === "PDF" ? data.fileId : null,
      createdById: user.id,
    },
  });
  return NextResponse.json({ note: { id: note.id } }, { status: 201 });
}
