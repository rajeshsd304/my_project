import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";
import { batchSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;
  const batches = await db.batch.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true } } },
  });
  return NextResponse.json({ batches });
}

export async function POST(req: Request) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, batchSchema);
  if (error) return error;
  try {
    const batch = await db.batch.create({ data });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    if (uniqueViolationField(err)) return jsonError("A batch with this name already exists.", 409);
    throw err;
  }
}
