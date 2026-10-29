import ExcelJS from "exceljs";
import Papa from "papaparse";
import { db } from "@/lib/db";
import { requireApiRole } from "@/lib/auth";
import { loadManagedExam } from "@/lib/exam-api";
import { finalizeExpiredAttempts, formatDuration } from "@/lib/exams";
import { formatDateTime } from "@/lib/format";
import { examLeaderboard } from "@/lib/results";

/** Export every submitted attempt (first attempts ranked; retakes listed as unranked). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authError } = await requireApiRole("ADMIN", "TEACHER");
  if (authError) return authError;
  const { exam, error } = await loadManagedExam(user, (await params).id);
  if (error) return error;
  await finalizeExpiredAttempts({ examId: exam.id });
  const [board, attempts] = await Promise.all([
    examLeaderboard(exam.id),
    db.attempt.findMany({
      where: { examId: exam.id, status: "SUBMITTED" },
      include: { user: { select: { name: true, phone: true, email: true, batch: { select: { name: true } } } } },
    }),
  ]);
  const rankOf = new Map(board.map((r) => [r.attemptId, r.rank]));
  const rows = attempts
    .map((a) => ({
      Rank: rankOf.get(a.id) ?? "",
      Name: a.user.name,
      Phone: a.user.phone ?? "",
      Email: a.user.email ?? "",
      Batch: a.user.batch?.name ?? "",
      Attempt: a.attemptNo,
      Score: a.score ?? 0,
      "Total marks": a.totalMarks ?? 0,
      Percentage: a.percentage ?? 0,
      Correct: a.correct ?? 0,
      Wrong: a.wrong ?? 0,
      Skipped: a.skipped ?? 0,
      "Negative marks": a.negativeTotal ?? 0,
      "Time taken": formatDuration(a.timeTakenSec),
      "Time (seconds)": a.timeTakenSec ?? 0,
      "Auto-submitted": a.autoSubmitted ? "Yes" : "No",
      Submitted: formatDateTime(a.submittedAt),
    }))
    .sort((x, y) => (x.Rank === "" ? 1 : 0) - (y.Rank === "" ? 1 : 0) || Number(x.Rank) - Number(y.Rank) || y.Score - x.Score);

  const safeTitle = exam.title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().replace(/\s+/g, "-") || "exam";
  const filename = (ext: string) => `attachment; filename="results.${ext}"; filename*=UTF-8''${encodeURIComponent(`${safeTitle}-results.${ext}`)}`;

  if (new URL(req.url).searchParams.get("format") === "csv") {
    return new Response("﻿" + Papa.unparse(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": filename("csv") } });
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Results", { views: [{ state: "frozen", ySplit: 1 }] });
  const keys = Object.keys(rows[0] ?? { Rank: "", Name: "" });
  ws.columns = keys.map((k) => ({ header: k, key: k, width: k === "Name" ? 28 : k === "Email" || k === "Submitted" ? 24 : 14, style: { font: { name: "Hind Siliguri", size: 11 } } }));
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { name: "Hind Siliguri", bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A6BFF" } };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": filename("xlsx") },
  });
}
