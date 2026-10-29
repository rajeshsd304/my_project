import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EditExamPage } from "@/features/exams/exam-pages";

export const metadata: Metadata = { title: "Edit exam" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole("TEACHER");
  return <EditExamPage user={user} base="/teacher" id={(await params).id} tab={(await searchParams).tab} />;
}
