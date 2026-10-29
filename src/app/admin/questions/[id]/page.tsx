import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { EditQuestionPage } from "@/features/questions/editor-pages";

export const metadata: Metadata = { title: "Edit question" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("ADMIN");
  return <EditQuestionPage user={user} base="/admin" id={(await params).id} />;
}
