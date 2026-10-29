import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ImportPage } from "@/features/questions/misc-pages";

export const metadata: Metadata = { title: "Import questions" };

export default async function Page() {
  await requireRole("TEACHER");
  return <ImportPage base="/teacher" />;
}
