import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";

const schema = z.object({
  batchId: z.string().nullable(),
  userIds: z.array(z.string()).min(1, "Select at least one student.").max(2000),
});

/** Assign (or with batchId=null, unassign) students to a batch in bulk. */
export async function POST(req: Request) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;
  if (data.batchId && !(await db.batch.count({ where: { id: data.batchId } }))) {
    return jsonError("Batch not found.", 404);
  }
  const result = await db.user.updateMany({
    where: { id: { in: data.userIds }, role: "STUDENT" },
    data: { batchId: data.batchId },
  });
  return NextResponse.json({ updated: result.count });
}
