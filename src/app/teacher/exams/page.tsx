import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ExamsListPage } from "@/features/exams/exam-pages";

export const metadata: Metadata = { title: "Exams" };

export default async function Page() {
  const user = await requireRole("TEACHER");
  return <ExamsListPage user={user} base="/teacher" />;
}
