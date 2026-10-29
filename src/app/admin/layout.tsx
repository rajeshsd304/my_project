import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

// Every page below /admin is server-guarded here (in addition to the middleware gate).
export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  return <AppShell user={user}>{children}</AppShell>;
}
