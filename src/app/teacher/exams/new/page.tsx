import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { NewExamPage } from "@/features/exams/exam-pages";

export const metadata: Metadata = { title: "New exam" };

export default async function Page() {
  await requireRole("TEACHER");
  return <NewExamPage base="/teacher" />;
}
