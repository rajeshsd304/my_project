import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { noteSchema } from "@/lib/content-schemas";
import { deleteStoredFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

async function loadEditable(id: string, user: { id: string; role: string }) {
  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note) return { error: jsonError("Note not found.", 404) };
  if (user.role !== "ADMIN" && note.createdById !== user.id) return { error: jsonError("You can only change notes you uploaded.", 403) };
  return { note };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { note, error: loadError } = await loadEditable((await params).id, user);
  if (loadError) return loadError;
  const { data, error } = await parseBody(req, noteSchema);
  if (error) return error;
  await db.studyNote.update({
    where: { id: note.id },
    data: {
      title: data.title,
      description: data.description || null,
      subjectId: data.subjectId,
      kind: data.kind,
      body: data.kind === "TEXT" ? data.body!.trim() : null,
      fileId: data.kind === "PDF" ? data.fileId : null,
    },
  });
  if (note.fileId && note.fileId !== (data.kind === "PDF" ? data.fileId : null)) await deleteStoredFile(note.fileId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { note, error } = await loadEditable((await params).id, user);
  if (error) return error;
  await db.studyNote.delete({ where: { id: note.id } });
  if (note.fileId) await deleteStoredFile(note.fileId);
  return NextResponse.json({ ok: true });
}
