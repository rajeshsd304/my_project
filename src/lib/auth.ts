// Authoritative session + RBAC guards for server components and route handlers.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "./db";
import { ROLE_HOME, type Role } from "./roles";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./token";

export type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  batchId: string | null;
};

/** Current user, re-validated against the database on every request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.sub } });
  // Reject deactivated users and sessions issued before a password reset / role change.
  if (!user || !user.active || user.tokenVersion !== session.v || user.role !== session.role) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role as Role,
    batchId: user.batchId,
  };
});

export async function startSession(user: { id: string; role: string; tokenVersion: number }) {
  const token = await signSession({ sub: user.id, role: user.role as Role, v: user.tokenVersion });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production; set INSECURE_COOKIES=true only to test a production build over plain HTTP.
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Page guard: redirects to login, or to the user's own dashboard when the role is not allowed. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}

/** API guard: returns the user or a 401/403 JSON response. */
export async function requireApiRole(
  ...roles: Role[]
): Promise<{ user: CurrentUser; error?: never } | { user?: never; error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Please log in to continue." }, { status: 401 }) };
  if (roles.length && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: "You do not have permission to do this." }, { status: 403 }) };
  }
  return { user };
}
