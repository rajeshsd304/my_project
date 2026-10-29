// Coarse, token-only access gate. Server guards in layouts and route handlers
// re-check every request against the database (deactivation, password resets).
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, rolesForPath } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/token";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // CSRF defence: state-changing API calls must come from this origin.
  if (isApi && MUTATING.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && origin !== req.nextUrl.origin) {
      return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
  }

  const allowed = rolesForPath(pathname);
  if (!allowed) return NextResponse.next();

  // (Logged-in users are bounced off /login and /register by those pages, using the
  // DB-validated session, so a stale cookie can never cause a redirect loop.)
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (isApi) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!allowed.includes(session.role)) {
    if (isApi) return NextResponse.json({ error: "You do not have permission to do this." }, { status: 403 });
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
