import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ImportsPage } from "@/features/questions/misc-pages";

export const metadata: Metadata = { title: "Import history" };

export default async function Page() {
  const user = await requireRole("ADMIN");
  return <ImportsPage user={user} base="/admin" />;
}
