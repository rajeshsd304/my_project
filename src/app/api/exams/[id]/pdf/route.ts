import { requireApiRole } from "@/lib/auth";
import { loadManagedExam } from "@/lib/exam-api";
import { htmlToPdf } from "@/lib/pdf";
import { examPaperHtml } from "@/lib/pdf-templates";
import { getSettings } from "@/lib/settings";

/** Printable question paper (kind=paper) or answer key with explanations (kind=key). Staff only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error } = await loadManagedExam(user, (await params).id);
  if (error) return error;
  const kind = new URL(req.url).searchParams.get("kind") === "key" ? "key" : "paper";
  const settings = await getSettings();
  const pdf = await htmlToPdf(await examPaperHtml(exam, settings.institutionName, kind), { footer: kind === "key" ? "Answer key" : "Question paper" });
  const name = `${exam.title}-${kind === "key" ? "answer-key" : "question-paper"}.pdf`;
  return new Response(pdf as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="exam.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`, "Cache-Control": "private, no-store" },
  });
}
