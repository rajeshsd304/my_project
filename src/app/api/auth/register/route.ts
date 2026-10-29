import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { startSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { jsonError, parseBody, uniqueViolationField } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { nameSchema, optionalEmail, optionalPhone, passwordSchema } from "@/lib/validation";

const schema = z.object({
  name: nameSchema,
  phone: optionalPhone.refine((v): v is string => !!v, "Phone number is required."),
  email: optionalEmail,
  password: passwordSchema,
});

export async function POST(req: Request) {
  const settings = await getSettings();
  if (!settings.allowSelfRegistration) {
    return jsonError("Registration is closed. Please contact the coaching center for an account.", 403);
  }

  const limit = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  if (!limit.ok) return jsonError("Too many registrations from this network. Try again later.", 429);

  const { data, error } = await parseBody(req, schema);
  if (error) return error;

  try {
    // Accounts are active immediately: no email/phone verification step exists.
    const user = await db.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        role: "STUDENT",
        passwordHash: await hashPassword(data.password),
      },
    });
    await startSession(user);
    return NextResponse.json({ redirect: "/student" }, { status: 201 });
  } catch (err) {
    const field = uniqueViolationField(err);
    if (field) return jsonError(`An account with this ${field} already exists. Try logging in.`, 409);
    throw err;
  }
}
