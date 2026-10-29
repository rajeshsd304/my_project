import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ResultsOverviewPage } from "@/features/exams/exam-results-page";

export const metadata: Metadata = { title: "Results" };

export default async function Page() {
  const user = await requireRole("ADMIN");
  return <ResultsOverviewPage user={user} base="/admin" />;
}
