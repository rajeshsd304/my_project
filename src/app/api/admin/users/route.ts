import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";
import { generatePassword, hashPassword } from "@/lib/password";
import { isRole } from "@/lib/roles";
import { batchExists, publicUserSelect } from "@/lib/users";
import { userCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const { error } = await requireApiRole("ADMIN");
  if (error) return error;

  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim();
  const role = params.get("role");
  const batchId = params.get("batchId");
  const where: Prisma.UserWhereInput = {
    ...(isRole(role) ? { role } : {}),
    ...(batchId ? { batchId: batchId === "none" ? null : batchId } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] } : {}),
  };
  const users = await db.user.findMany({ where, select: publicUserSelect, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const { error: authError } = await requireApiRole("ADMIN");
  if (authError) return authError;
  const { data, error } = await parseBody(req, userCreateSchema);
  if (error) return error;

  if (data.role !== "STUDENT" && data.batchId) return jsonError("Only students can belong to a batch.");
  if (!(await batchExists(data.batchId))) return jsonError("Selected batch no longer exists.");

  // No email is ever sent: if the admin leaves the password blank we generate one and show it once.
  const password = data.password ?? generatePassword();
  try {
    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        batchId: data.role === "STUDENT" ? data.batchId : null,
        passwordHash: await hashPassword(password),
      },
      select: publicUserSelect,
    });
    return NextResponse.json({ user, password: data.password ? undefined : password }, { status: 201 });
  } catch (err) {
    const field = uniqueViolationField(err);
    if (field) return jsonError(`Another account already uses this ${field}.`, 409);
    throw err;
  }
}
