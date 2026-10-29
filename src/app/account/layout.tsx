import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN", "TEACHER", "STUDENT");
  return <AppShell user={user}>{children}</AppShell>;
}
