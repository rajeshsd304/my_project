import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { announcementSchema } from "@/lib/content-schemas";

export async function GET() {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;
  const announcements = await db.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { batch: { select: { name: true } } } });
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, announcementSchema);
  if (error) return error;
  if (data.batchId && !(await db.batch.count({ where: { id: data.batchId } }))) return jsonError("Batch not found.", 404);
  const a = await db.announcement.create({ data: { ...data, batchId: data.batchId || null, createdById: user.id } });
  return NextResponse.json({ announcement: a }, { status: 201 });
}
