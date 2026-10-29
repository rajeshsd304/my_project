import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";
import { batchExists, isLastActiveAdmin, publicUserSelect } from "@/lib/users";
import { userUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { user: admin, error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { id } = await params;
  const { data, error } = await parseBody(req, userUpdateSchema);
  if (error) return error;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return jsonError("User not found.", 404);

  const role = data.role ?? target.role;
  const active = data.active ?? target.active;
  const losingAdmin = target.role === "ADMIN" && (role !== "ADMIN" || !active);
  if (losingAdmin && id === admin.id) return jsonError("You cannot remove your own admin access.");
  if (losingAdmin && (await isLastActiveAdmin(id))) return jsonError("At least one active admin must remain.");

  const email = data.email === undefined ? target.email : data.email;
  const phone = data.phone === undefined ? target.phone : data.phone;
  if (!email && !phone) return jsonError("Provide a phone number or an email address.");

  let batchId = data.batchId === undefined ? target.batchId : data.batchId;
  if (role !== "STUDENT") batchId = null;
  if (!(await batchExists(batchId))) return jsonError("Selected batch no longer exists.");

  // Role change or deactivation invalidates existing sessions immediately.
  const revoke = role !== target.role || active !== target.active;
  try {
    const user = await db.user.update({
      where: { id },
      data: {
        name: data.name,
        email,
        phone,
        role,
        active,
        batchId,
        ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: publicUserSelect,
    });
    return NextResponse.json({ user });
  } catch (err) {
    const field = uniqueViolationField(err);
    if (field) return jsonError(`Another account already uses this ${field}.`, 409);
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { user: admin, error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { id } = await params;

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return jsonError("User not found.", 404);
  if (id === admin.id) return jsonError("You cannot delete your own account.");
  if (target.role === "ADMIN" && (await isLastActiveAdmin(id))) return jsonError("At least one active admin must remain.");

  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
