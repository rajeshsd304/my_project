import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireApiRole, startSession } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export async function POST(req: Request) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER", "STUDENT");
  if (authError) return authError;
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(data.currentPassword, record.passwordHash))) {
    return jsonError("Current password is incorrect.", 400);
  }
  // Bump tokenVersion to sign out other devices, then re-issue this device's session.
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.newPassword), tokenVersion: { increment: 1 } },
  });
  await startSession(updated);
  return NextResponse.json({ ok: true });
}
