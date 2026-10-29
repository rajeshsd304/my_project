import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApiRole, startSession } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { generatePassword, hashPassword } from "@/lib/password";
import { optionalPassword } from "@/lib/validation";

const schema = z.object({ password: optionalPassword });

/** Manual password reset by an admin (the platform never sends email). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user: admin, error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { id } = await params;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  if (!(await db.user.count({ where: { id } }))) return jsonError("User not found.", 404);

  const password = data.password ?? generatePassword();
  const updated = await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
  });
  // Resetting your own password should not sign you out of this device.
  if (id === admin.id) await startSession(updated);
  return NextResponse.json({ password });
}
