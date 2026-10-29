export const ROLES = ["ADMIN", "TEACHER", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Home dashboard for each role. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

/**
 * Which roles may access each protected path prefix.
 * Used by middleware (coarse, token-only) and by server guards (authoritative).
 */
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/api/admin", roles: ["ADMIN"] },
  { prefix: "/teacher", roles: ["TEACHER"] },
  { prefix: "/api/teacher", roles: ["TEACHER", "ADMIN"] },
  { prefix: "/student", roles: ["STUDENT"] },
  { prefix: "/api/student", roles: ["STUDENT"] },
  { prefix: "/api/taxonomy", roles: ["ADMIN", "TEACHER"] },
  { prefix: "/api/questions", roles: ["ADMIN", "TEACHER"] },
  { prefix: "/api/exams", roles: ["ADMIN", "TEACHER"] },
  { prefix: "/api/uploads", roles: ["ADMIN", "TEACHER"] },
  { prefix: "/api/announcements", roles: ["ADMIN"] },
  { prefix: "/api/notes", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { prefix: "/api/files", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { prefix: "/api/attempts", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { prefix: "/exam", roles: ["STUDENT"] },
  { prefix: "/account", roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { prefix: "/api/me", roles: ["ADMIN", "TEACHER", "STUDENT"] },
];

export function rolesForPath(pathname: string): Role[] | null {
  const match = ROUTE_ACCESS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
  return match ? match.roles : null;
}
