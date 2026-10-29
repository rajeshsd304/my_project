import { NextResponse } from "next/server";
import type { ZodError, ZodTypeAny, output } from "zod";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function firstIssue(error: ZodError) {
  const issue = error.issues[0];
  return issue?.message ?? "Invalid input.";
}

/** Parse a JSON body with a zod schema; returns data or a 400 response. */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: output<S>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError("Request body must be valid JSON.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) return { error: jsonError(firstIssue(result.error)) };
  return { data: result.data as output<S> };
}

/** Prisma unique-constraint violation → which field collided. */
export function uniqueViolationField(err: unknown): string | null {
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
    const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
    return Array.isArray(target) ? target.join(", ") : (target ?? "field");
  }
  return null;
}
