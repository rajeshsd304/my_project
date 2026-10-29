import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { NewQuestionPage } from "@/features/questions/editor-pages";

export const metadata: Metadata = { title: "New question" };

export default async function Page() {
  await requireRole("TEACHER");
  return <NewQuestionPage base="/teacher" />;
}
