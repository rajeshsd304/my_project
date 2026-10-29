import "server-only";
import type { Exam } from "@prisma/client";
import { db } from "./db";
import { formatDuration, negativeRuleText, EXAM_TYPE_LABEL, type ExamType } from "./exams";
import { formatDateTime, formatNumber } from "./format";
import { escapeHtml, pdfDocument } from "./pdf";
import { OPTION_LETTERS } from "./question-content";
import { renderRich } from "./rich";
import { readStoredFile } from "./storage";
import type { Breakdown } from "./results";

type PdfQuestion = {
  textBn: string | null;
  textEn: string | null;
  explanationBn: string | null;
  explanationEn: string | null;
  imageId: string | null;
  options: { id: string; textBn: string | null; textEn: string | null; isCorrect: boolean }[];
};

/** Bangla first, English directly below — the same fixed layout students see. */
function bi(bn: string | null, en: string | null) {
  return `${bn ? `<div lang="bn">${renderRich(bn)}</div>` : ""}${en ? `<div lang="en" class="${bn ? "en" : ""}">${renderRich(en)}</div>` : ""}`;
}

async function imageTag(imageId: string | null) {
  if (!imageId) return "";
  const file = await db.storedFile.findUnique({ where: { id: imageId } });
  if (!file) return "";
  const data = await readStoredFile(file.path).catch(() => null);
  return data ? `<img class="fig" src="data:${file.mime};base64,${data.toString("base64")}" alt="">` : "";
}

async function questionHtml(q: PdfQuestion, n: number, mode: "paper" | "key") {
  const long = q.options.some((o) => (o.textBn?.length ?? 0) + (o.textEn?.length ?? 0) > 40 || (o.textBn && o.textEn));
  const opts = q.options
    .map((o, i) => `<div class="opt ${mode === "key" && o.isCorrect ? "correct" : ""}"><span class="l">(${OPTION_LETTERS[i]})</span><div>${bi(o.textBn, o.textEn)}</div>${mode === "key" && o.isCorrect ? " ✓" : ""}</div>`)
    .join("");
  const correct = q.options.flatMap((o, i) => (o.isCorrect ? [OPTION_LETTERS[i]] : [])).join(", ");
  const exp = mode === "key" && (q.explanationBn || q.explanationEn) ? `<div class="exp"><b>Explanation</b>${bi(q.explanationBn, q.explanationEn)}</div>` : "";
  return `<div class="q"><div class="head"><span class="no">${n}.</span><div>${bi(q.textBn, q.textEn)}</div></div>${await imageTag(q.imageId)}<div class="opts ${long ? "wide" : ""}">${opts}</div>${mode === "key" ? `<div class="ans"><b>Correct answer:</b> ${correct}</div>` : ""}${exp}</div>`;
}

function header(institution: string, title: string, sub: string) {
  return `<div class="brand"><div><div class="name">${escapeHtml(institution)}</div><h1>${escapeHtml(title)}</h1><div class="muted small">${escapeHtml(sub)}</div></div><div class="small muted" style="text-align:right">Generated<br>${escapeHtml(formatDateTime(new Date()))}</div></div>`;
}

export async function examPaperHtml(exam: Exam, institution: string, mode: "paper" | "key") {
  const items = await db.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { sortOrder: "asc" },
    include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
  });
  const total = items.length * exam.marksPerQuestion;
  const facts = [
    EXAM_TYPE_LABEL[exam.type as ExamType],
    `Questions: ${items.length}`,
    `Total marks: ${formatNumber(total)}`,
    `Marks per question: ${formatNumber(exam.marksPerQuestion)}`,
    `Time: ${exam.durationMinutes ? `${exam.durationMinutes} minutes` : "Untimed"}`,
    ...(exam.passMark != null ? [`Pass mark: ${formatNumber(exam.passMark)}`] : []),
  ];
  const parts: string[] = [];
  for (const [i, it] of items.entries()) parts.push(await questionHtml(it.question, i + 1, mode));
  const body = `${header(institution, exam.title, mode === "key" ? "Answer key with explanations" : "Question paper")}
<div class="facts">${facts.map((f) => `<span>${escapeHtml(f)}</span>`).join("")}</div>
<div class="rule">${escapeHtml(negativeRuleText(exam))}. Skipped questions are not penalised.</div>
${mode === "paper" && exam.instructions ? `<div class="small" style="margin:6pt 0 10pt"><b>Instructions:</b> ${renderRich(exam.instructions)}</div>` : ""}
<h2>${mode === "key" ? "Answers" : "Questions"}</h2>${parts.join("")}`;
  return pdfDocument(`${exam.title} — ${mode === "key" ? "Answer key" : "Question paper"}`, body);
}

export function resultSlipHtml(p: {
  institution: string;
  student: { name: string; phone: string | null; email: string | null; batch: string | null };
  exam: Exam;
  attempt: { score: number | null; totalMarks: number | null; percentage: number | null; correct: number | null; wrong: number | null; skipped: number | null; negativeTotal: number | null; timeTakenSec: number | null; submittedAt: Date | null; attemptNo: number };
  rank: { rank: number; of: number } | null;
  subjects: Breakdown[];
}) {
  const { attempt: a, exam } = p;
  const passed = exam.passMark != null ? ((a.score ?? 0) >= exam.passMark ? "Passed" : "Not passed") : null;
  const cells: [string, string][] = [
    ["Percentage", `${formatNumber(a.percentage)}%`],
    ["Merit position", p.rank ? `${p.rank.rank} of ${p.rank.of}` : a.attemptNo > 1 ? "Retake (not ranked)" : "—"],
    ["Time taken", formatDuration(a.timeTakenSec)],
    ["Correct", String(a.correct ?? 0)],
    ["Wrong", String(a.wrong ?? 0)],
    ["Skipped", String(a.skipped ?? 0)],
    ["Negative marks deducted", formatNumber(a.negativeTotal ?? 0)],
    ["Marking rule", negativeRuleText(exam)],
    ...(passed ? [["Result", `${passed} (pass mark ${formatNumber(exam.passMark)})`] as [string, string]] : []),
  ];
  const rows = p.subjects
    .map((s) => `<tr><td lang="bn">${escapeHtml(s.name)}</td><td class="num">${s.total}</td><td class="num">${s.correct}</td><td class="num">${s.wrong}</td><td class="num">${s.skipped}</td><td class="num">${s.accuracy}%</td></tr>`)
    .join("");
  const body = `${header(p.institution, "Result Slip", exam.title)}
<table style="margin-bottom:10pt"><tr><th style="width:24%">Student name</th><td lang="bn" style="font-size:13pt;font-weight:600">${escapeHtml(p.student.name)}</td></tr>
<tr><th>Phone / Email</th><td>${escapeHtml([p.student.phone, p.student.email].filter(Boolean).join(" · ") || "—")}</td></tr>
<tr><th>Batch</th><td lang="bn">${escapeHtml(p.student.batch ?? "—")}</td></tr>
<tr><th>Exam</th><td lang="bn">${escapeHtml(exam.title)}</td></tr>
<tr><th>Submitted</th><td>${escapeHtml(formatDateTime(a.submittedAt))}</td></tr></table>
<div style="display:flex;align-items:flex-end;gap:16pt"><div><div class="small muted">Score</div><div class="score">${formatNumber(a.score)} <span style="font-size:14pt;color:#555">/ ${formatNumber(a.totalMarks)}</span></div></div>
${p.rank ? `<div><div class="small muted">Rank</div><div class="score">#${p.rank.rank}</div></div>` : ""}</div>
<div class="grid">${cells.map(([k, v]) => `<div class="cell"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join("")}</div>
<h2>Subject-wise breakdown</h2>
<table><thead><tr><th>Subject</th><th class="num">Questions</th><th class="num">Correct</th><th class="num">Wrong</th><th class="num">Skipped</th><th class="num">Accuracy</th></tr></thead><tbody>${rows || `<tr><td colspan="6">No data</td></tr>`}</tbody></table>`;
  return pdfDocument(`Result slip — ${p.student.name}`, body);
}
