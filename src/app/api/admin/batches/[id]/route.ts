import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";
import { batchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { id } = await params;
  const { data, error } = await parseBody(req, batchSchema);
  if (error) return error;
  if (!(await db.batch.count({ where: { id } }))) return jsonError("Batch not found.", 404);
  try {
    const batch = await db.batch.update({ where: { id }, data });
    return NextResponse.json({ batch });
  } catch (err) {
    if (uniqueViolationField(err)) return jsonError("A batch with this name already exists.", 409);
    throw err;
  }
}

/** Deleting a batch keeps its students; they simply become unassigned. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;
  const { id } = await params;
  if (!(await db.batch.count({ where: { id } }))) return jsonError("Batch not found.", 404);
  await db.batch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
