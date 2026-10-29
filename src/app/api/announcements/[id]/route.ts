import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { announcementSchema } from "@/lib/content-schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { id } = await params;
  const { data, error } = await parseBody(req, announcementSchema);
  if (error) return error;
  if (!(await db.announcement.count({ where: { id } }))) return jsonError("Announcement not found.", 404);
  const a = await db.announcement.update({ where: { id }, data: { ...data, batchId: data.batchId || null } });
  return NextResponse.json({ announcement: a });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;
  await db.announcement.delete({ where: { id: (await params).id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
