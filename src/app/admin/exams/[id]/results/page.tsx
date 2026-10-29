import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ExamResultsPage } from "@/features/exams/exam-results-page";

export const metadata: Metadata = { title: "Exam results" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("ADMIN");
  return <ExamResultsPage user={user} base="/admin" id={(await params).id} />;
}
