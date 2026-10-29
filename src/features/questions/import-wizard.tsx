"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import Papa from "papaparse";
import { api } from "@/lib/client-api";
import { checkRows, TEMPLATE_COLUMNS, type CheckedRow, type ImportRow, type RowStatus, type TemplateKind } from "@/lib/question-import";
import { renderQuestion } from "@/lib/render-question";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";
import { QuestionView } from "@/components/question-view";
import { Alert } from "@/components/ui";

type Preview = {
  fileName: string;
  template: TemplateKind;
  notice: string | null;
  columns: string[];
  rows: ImportRow[];
  zipImages: string[] | null;
  zipToken: string | null;
  bankHashes: string[];
};

type Result = { imported: number; skipped: number; warnings: number };

const STATUS_STYLE: Record<RowStatus, { badge: string; border: string; label: string }> = {
  OK: { badge: "border-success/40 bg-success-soft text-success", border: "border-l-success", label: "OK" },
  WARNING: { badge: "border-warning/40 bg-warning-soft text-warning", border: "border-l-warning", label: "Warning" },
  ERROR: { badge: "border-danger/40 bg-danger-soft text-danger", border: "border-l-danger", label: "Error" },
};

const PAGE = 40;

export function ImportWizard({ taxonomy, base }: { taxonomy: TaxonomyTree; base: string }) {
  const [template, setTemplate] = useState<TemplateKind>("SIMPLE");
  const [language, setLanguage] = useState<"BN" | "EN">("BN");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [unitId, setUnitId] = useState(taxonomy[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [filter, setFilter] = useState<RowStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const unit = taxonomy.find((u) => u.id === unitId);
  const subject = unit?.subjects.find((s) => s.id === subjectId);
  const effectiveTemplate = preview?.template ?? template;

  const checked: CheckedRow[] = useMemo(
    () =>
      preview
        ? checkRows(rows, { template: preview.template, language, allowMultiple, zipImages: preview.zipImages, bankHashes: preview.bankHashes })
        : [],
    [preview, rows, language, allowMultiple],
  );
  const counts = useMemo(() => {
    const c = { OK: 0, WARNING: 0, ERROR: 0 };
    checked.forEach((r) => c[r.status]++);
    return c;
  }, [checked]);
  const visible = checked.filter((r) => filter === "ALL" || r.status === filter);
  const pageRows = visible.slice(page * PAGE, page * PAGE + PAGE);
  const importable = counts.OK + counts.WARNING;

  async function runPreview() {
    if (!file) return setError("Choose a .xlsx or .csv file.");
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      if (zip) form.set("images", zip);
      form.set("template", template);
      form.set("language", language);
      form.set("allowMultiple", String(allowMultiple));
      const res = await fetch("/api/questions/import/preview", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not read the file.");
      setPreview(data);
      setRows(data.rows);
      setFilter("ALL");
      setPage(0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function commit() {
    if (!preview) return;
    if (!subjectId) return setError("Choose the subject these questions belong to.");
    setPending(true);
    setError(null);
    try {
      const res = await api<Result>("/api/questions/import/commit", {
        body: {
          fileName: preview.fileName,
          template: preview.template,
          language,
          allowMultiple,
          subjectId,
          topicId: topicId || null,
          zipToken: preview.zipToken,
          // All rows go to the server: it re-validates, imports the valid ones and records the rest as skipped.
          rows: checked.map(({ line, raw }) => ({ line, raw })),
        },
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function downloadErrorReport() {
    if (!preview) return;
    const extra = preview.columns.filter((c) => /^option_[ef](_bn|_en)?$/.test(c) && !TEMPLATE_COLUMNS[preview.template].includes(c));
    const fields = [...TEMPLATE_COLUMNS[preview.template], ...extra, "error_reason"];
    const data = checked
      .filter((r) => r.status === "ERROR")
      .map((r) => fields.map((f) => (f === "error_reason" ? `Row ${r.line}: ${r.errors.join(" ")}` : (r.raw[f] ?? ""))));
    const csv = "﻿" + Papa.unparse({ fields, data });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `error-report-${preview.fileName.replace(/\.[^.]+$/, "")}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setPreview(null);
    setRows([]);
    setResult(null);
    setFile(null);
    setZip(null);
    setError(null);
  }

  if (result) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center sm:p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success"><Icon name="check" className="size-7" /></span>
        <h2 className="mt-4 text-xl font-bold">Import complete</h2>
        <dl className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Imported" value={result.imported} tone="text-success" />
          <Stat label="Skipped" value={result.skipped} tone="text-danger" />
          <Stat label="With warnings" value={result.warnings} tone="text-warning" />
        </dl>
        <p className="mt-4 text-sm text-muted">You can undo this import from Import history for the next 24 hours.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`${base}/questions`} className="btn btn-primary">Go to question bank</Link>
          <Link href={`${base}/questions/imports`} className="btn btn-secondary">Import history</Link>
          <button type="button" className="btn btn-ghost" onClick={reset}>Import another file</button>
        </div>
      </div>
    );
  }

  const placement = (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Unit">
        <select className="input" value={unitId} onChange={(e) => { setUnitId(e.target.value); setSubjectId(""); setTopicId(""); }}>
          {taxonomy.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Subject">
        <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); }}>
          <option value="">Choose…</option>
          {unit?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Topic (optional)">
        <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subject}>
          <option value="">No topic</option>
          {subject?.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </Field>
    </div>
  );

  if (!preview) {
    return (
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <Step n={1} title="Choose a template">
          <div className="grid gap-3 md:grid-cols-2">
            {(["SIMPLE", "BOTH"] as const).map((t) => (
              <div
                key={t}
                role="radio"
                aria-checked={template === t}
                tabIndex={0}
                onClick={() => setTemplate(t)}
                onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setTemplate(t)}
                className={`cursor-pointer rounded-xl border p-4 transition-colors ${template === t ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2 hover:border-subtle"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t === "SIMPLE" ? "Simple (one language)" : "Bangla + English"}</span>
                  <span className={`size-4 rounded-full border-2 ${template === t ? "border-accent bg-accent" : "border-line-strong"}`} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {t === "SIMPLE" ? "question, option_a…option_d, correct_answer, explanation, difficulty, tags" : "question_bn / question_en, option_a_bn / option_a_en …, explanation_bn / _en"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <a href={`/api/questions/template?type=${t === "BOTH" ? "both" : "simple"}&format=xlsx`} className="btn btn-secondary min-h-9 py-1.5 text-xs">
                    <Icon name="download" className="size-4" /> Excel (.xlsx), recommended
                  </a>
                  <a href={`/api/questions/template?type=${t === "BOTH" ? "both" : "simple"}&format=csv`} className="btn btn-ghost min-h-9 py-1.5 text-xs">
                    <Icon name="download" className="size-4" /> CSV
                  </a>
                </div>
              </div>
            ))}
          </div>
          {template === "SIMPLE" && (
            <div className="mt-4 max-w-xs">
              <Field label="Language of this file">
                <select className="input" value={language} onChange={(e) => setLanguage(e.target.value as "BN" | "EN")}>
                  <option value="BN">Bangla</option>
                  <option value="EN">English</option>
                </select>
              </Field>
            </div>
          )}
        </Step>

        <Step n={2} title="Where should the questions go?">{placement}</Step>

        <Step n={3} title="Upload">
          <div className="grid gap-3 md:grid-cols-2">
            <FilePick label="Questions file" hint=".xlsx or .csv (UTF-8)" accept=".xlsx,.csv,text/csv" file={file} onFile={setFile} icon="file" />
            <FilePick label="Images ZIP (optional)" hint='Only if you used the "image" column' accept=".zip,application/zip" file={zip} onFile={setZip} icon="upload" />
          </div>
          <label className="mt-4 flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="size-4 accent-[var(--accent)]" />
            Allow multiple correct answers (e.g. correct_answer “A,C”)
          </label>
        </Step>

        <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={pending || !file} onClick={runPreview}>
          {pending ? "Reading file…" : "Preview import"}
        </button>
        <p className="text-xs text-subtle">Nothing is saved until you confirm on the next screen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {preview.notice && <Alert tone="info">{preview.notice}</Alert>}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{preview.fileName}</div>
            <div className="text-sm text-muted">
              {rows.length} rows · {effectiveTemplate === "BOTH" ? "Both-language template" : `Simple template (${language === "BN" ? "Bangla" : "English"})`}
              {preview.zipImages && ` · ${preview.zipImages.length} images in ZIP`}
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            <span className={`badge ${STATUS_STYLE.OK.badge}`}>{counts.OK} OK</span>
            <span className={`badge ${STATUS_STYLE.WARNING.badge}`}>{counts.WARNING} warnings</span>
            <span className={`badge ${STATUS_STYLE.ERROR.badge}`}>{counts.ERROR} errors</span>
          </div>
        </div>
        <div className="mt-4">{placement}</div>
        {effectiveTemplate === "SIMPLE" && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Language
              <select className="input w-auto py-1.5 text-sm" value={language} onChange={(e) => setLanguage(e.target.value as "BN" | "EN")}>
                <option value="BN">Bangla</option>
                <option value="EN">English</option>
              </select>
            </label>
          </div>
        )}
        <label className="mt-3 flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Allow multiple correct answers
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["ALL", "ERROR", "WARNING", "OK"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setFilter(f); setPage(0); }}
            className={`btn min-h-9 px-3 py-1.5 text-xs ${filter === f ? "btn-primary" : "btn-secondary"}`}
          >
            {f === "ALL" ? `All (${checked.length})` : `${STATUS_STYLE[f].label}s (${counts[f]})`}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {pageRows.map((r) => {
          const idx = rows.findIndex((x) => x.line === r.line);
          return (
            <li key={r.line} className={`card border-l-4 ${STATUS_STYLE[r.status].border} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Row {r.line}</span>
                  <span className={`badge ${STATUS_STYLE[r.status].badge}`}>{STATUS_STYLE[r.status].label}</span>
                  {r.question && <span className="text-xs text-subtle">{r.question.language === "BOTH" ? "Bangla + English" : r.question.language === "BN" ? "Bangla" : "English"}</span>}
                </div>
                <button type="button" className="btn btn-ghost min-h-8 px-2.5 py-1 text-xs" onClick={() => setEditing(editing === r.line ? null : r.line)}>
                  <Icon name="pen" className="size-3.5" /> {editing === r.line ? "Close editor" : "Edit row"}
                </button>
              </div>
              {(r.errors.length > 0 || r.warnings.length > 0) && (
                <ul className="space-y-1 px-4 pt-3 text-sm">
                  {r.errors.map((m, i) => <li key={`e${i}`} className="text-danger">Row {r.line}: {m}</li>)}
                  {r.warnings.map((m, i) => <li key={`w${i}`} className="text-warning">Row {r.line}: {m}</li>)}
                </ul>
              )}
              <div className="p-4">
                {editing === r.line ? (
                  <RowEditor
                    row={rows[idx]}
                    columns={[...new Set([...TEMPLATE_COLUMNS[preview.template], ...preview.columns.filter((c) => /^option_[ef]/.test(c))])]}
                    onSave={(raw) => {
                      setRows(rows.map((x, i) => (i === idx ? { ...x, raw } : x)));
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : r.question ? (
                  <RowPreview row={r} />
                ) : (
                  <RawSummary raw={r.raw} />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {visible.length > PAGE && (
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-muted">Rows {page * PAGE + 1}–{Math.min(visible.length, (page + 1) * PAGE)} of {visible.length}</span>
          <button type="button" className="btn btn-secondary" disabled={(page + 1) * PAGE >= visible.length} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-2 border-t border-line bg-black/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button type="button" className="btn btn-primary" disabled={pending || importable === 0} onClick={commit}>
          {pending ? "Importing…" : counts.ERROR ? `Import valid rows only (${importable} of ${checked.length})` : `Import all ${importable} rows`}
        </button>
        {counts.ERROR > 0 && (
          <button type="button" className="btn btn-secondary" onClick={downloadErrorReport}>
            <Icon name="download" className="size-4" /> Error report (CSV)
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={reset}>Start over</button>
      </div>
    </div>
  );
}

function RowPreview({ row }: { row: CheckedRow }) {
  const q = row.question!;
  const data = useMemo(
    () =>
      renderQuestion(
        {
          textBn: q.text.bn,
          textEn: q.text.en,
          explanationBn: q.explanation.bn,
          explanationEn: q.explanation.en,
          options: q.options.map((o, i) => ({ id: String(i), textBn: o.bn, textEn: o.en })),
        },
        { explanation: true },
      ),
    [q],
  );
  return (
    <div>
      <QuestionView data={data} multi={q.options.filter((o) => o.isCorrect).length > 1} optionState={(id) => (q.options[Number(id)].isCorrect ? "correct" : "idle")} />
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <span className="badge border-line-strong text-muted">{q.difficulty[0] + q.difficulty.slice(1).toLowerCase()}</span>
        {q.tags.map((t) => <span key={t} className="badge border-accent/25 text-accent-text">#{t}</span>)}
        {row.image && <span className="badge border-line-strong text-muted">Image: {row.image}</span>}
      </div>
    </div>
  );
}

function RawSummary({ raw }: { raw: Record<string, string> }) {
  const filled = Object.entries(raw).filter(([, v]) => v && v.trim());
  if (!filled.length) return <p className="text-sm text-subtle">Empty row.</p>;
  return (
    <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[160px_1fr]">
      {filled.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-xs text-subtle">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RowEditor({ row, columns, onSave, onCancel }: { row: ImportRow; columns: string[]; onSave: (raw: Record<string, string>) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...row.raw });
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {columns.map((c) => (
          <label key={c} className={c.startsWith("question") || c.startsWith("explanation") ? "sm:col-span-2" : ""}>
            <span className="mb-1 block font-mono text-xs text-subtle">{c}</span>
            {c.startsWith("question") || c.startsWith("explanation") ? (
              <textarea rows={2} className="input text-sm" value={draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} />
            ) : (
              <input className="input text-sm" value={draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-primary min-h-9 py-1.5" onClick={() => onSave(draft)}>Apply changes</button>
        <button type="button" className="btn btn-ghost min-h-9 py-1.5" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2.5 font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-sm text-accent-text">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function FilePick({ label, hint, accept, file, onFile, icon }: { label: string; hint: string; accept: string; file: File | null; onFile: (f: File | null) => void; icon: "file" | "upload" }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center transition-colors hover:border-accent">
      <Icon name={icon} className="size-6 text-accent-text" />
      <span className="mt-2 text-sm font-medium">{file ? file.name : label}</span>
      <span className="mt-0.5 text-xs text-subtle">{file ? `${(file.size / 1024).toFixed(1)} KB` : hint}</span>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
