import "server-only";
import { db } from "./db";
import type { CurrentUser } from "./auth";
import { jsonError } from "./api";

export async function loadOwnAttempt(user: CurrentUser, id: string) {
  const attempt = await db.attempt.findUnique({ where: { id } });
  if (!attempt || attempt.userId !== user.id) return { error: jsonError("Attempt not found.", 404) };
  return { attempt };
}
