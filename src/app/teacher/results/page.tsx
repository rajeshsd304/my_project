import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ResultsOverviewPage } from "@/features/exams/exam-results-page";

export const metadata: Metadata = { title: "Results" };

export default async function Page() {
  const user = await requireRole("TEACHER");
  return <ResultsOverviewPage user={user} base="/teacher" />;
}
