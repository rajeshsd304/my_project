import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { NotesStaffPage } from "@/features/content/pages";

export const metadata: Metadata = { title: "Study Notes" };

export default async function Page() {
  const user = await requireRole("ADMIN");
  return <NotesStaffPage user={user} />;
}
