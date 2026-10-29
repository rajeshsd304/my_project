import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { canManageExam, resultsReleased } from "@/lib/exams";
import { htmlToPdf } from "@/lib/pdf";
import { resultSlipHtml } from "@/lib/pdf-templates";
import { attemptRank, performanceBreakdown } from "@/lib/results";
import { getSettings } from "@/lib/settings";

/** Result slip PDF: the student (once results are released), the exam's owner, or an admin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireApiRole("ADMIN", "TEACHER", "STUDENT");
  if (error) return error;
  const attempt = await db.attempt.findUnique({
    where: { id: (await params).id },
    include: { exam: true, user: { select: { name: true, phone: true, email: true, batch: { select: { name: true } } } } },
  });
  if (!attempt || attempt.status !== "SUBMITTED") return jsonError("Result not found.", 404);
  const allowed = user.role === "STUDENT" ? attempt.userId === user.id && resultsReleased(attempt.exam) : canManageExam(user, attempt.exam);
  if (!allowed) return jsonError("Result not found.", 404);

  const [settings, rank, breakdown] = await Promise.all([getSettings(), attemptRank(attempt), performanceBreakdown([attempt.id])]);
  const html = resultSlipHtml({
    institution: settings.institutionName,
    student: { name: attempt.user.name, phone: attempt.user.phone, email: attempt.user.email, batch: attempt.user.batch?.name ?? null },
    exam: attempt.exam,
    attempt,
    rank,
    subjects: [...breakdown.subjects].sort((a, b) => a.name.localeCompare(b.name)),
  });
  const pdf = await htmlToPdf(html, { footer: "Result slip" });
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="result-slip.pdf"; filename*=UTF-8''${encodeURIComponent(`result-slip-${attempt.user.name}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
