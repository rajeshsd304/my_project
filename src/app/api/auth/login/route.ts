import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseIdentifier } from "@/lib/identity";
import { getDummyHash, verifyPassword } from "@/lib/password";
import { startSession } from "@/lib/auth";
import { jsonError, parseBody } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { ROLE_HOME, type Role } from "@/lib/roles";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your phone number or email."),
  password: z.string().min(1, "Enter your password."),
});

const INVALID = "Incorrect phone/email or password.";

export async function POST(req: Request) {
  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  const limit = rateLimit(`login:${clientIp(req)}:${data.identifier.toLowerCase()}`, 10, 15 * 60_000);
  if (!limit.ok) {
    return jsonError(`Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minute(s).`, 429);
  }

  const where = parseIdentifier(data.identifier);
  const user = where ? await db.user.findUnique({ where }) : null;
  const valid = await verifyPassword(data.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) return jsonError(INVALID, 401);
  if (!user.active) return jsonError("This account has been deactivated. Please contact the coaching center.", 403);

  await startSession(user);
  return NextResponse.json({ redirect: ROLE_HOME[user.role as Role] });
}
