import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";
import { getTaxonomy } from "@/lib/taxonomy";

export async function GET() {
  const { error } = await requireApiRole("ADMIN", "TEACHER");
  if (error) return error;
  return NextResponse.json({ units: await getTaxonomy() });
}

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unit"), name: z.string().trim().min(1).max(80) }),
  z.object({ kind: z.literal("subject"), name: z.string().trim().min(1).max(80), parentId: z.string() }),
  z.object({ kind: z.literal("topic"), name: z.string().trim().min(1).max(80), parentId: z.string() }),
]);

/** Create a unit, subject (parent = unit) or topic (parent = subject). Admin only. */
export async function POST(req: Request) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  try {
    if (data.kind === "unit") {
      const count = await db.unit.count();
      return NextResponse.json({ item: await db.unit.create({ data: { name: data.name, sortOrder: count } }) }, { status: 201 });
    }
    if (data.kind === "subject") {
      if (!(await db.unit.count({ where: { id: data.parentId } }))) return jsonError("Unit not found.", 404);
      const count = await db.subject.count({ where: { unitId: data.parentId } });
      const item = await db.subject.create({ data: { name: data.name, unitId: data.parentId, sortOrder: count } });
      return NextResponse.json({ item }, { status: 201 });
    }
    if (!(await db.subject.count({ where: { id: data.parentId } }))) return jsonError("Subject not found.", 404);
    return NextResponse.json({ item: await db.topic.create({ data: { name: data.name, subjectId: data.parentId } }) }, { status: 201 });
  } catch (err) {
    if (uniqueViolationField(err)) return jsonError(`A ${data.kind} with this name already exists here.`, 409);
    throw err;
  }
}
