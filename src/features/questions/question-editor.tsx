"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client-api";
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  LANGUAGES,
  LANGUAGE_LABEL,
  MAX_OPTIONS,
  OPTION_LETTERS,
  parseTags,
  validateQuestion,
  type Difficulty,
  type Language,
} from "@/lib/question-content";
import { mathErrors } from "@/lib/rich";
import { renderQuestion } from "@/lib/render-question";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { PhoneticTextarea } from "@/components/forms/phonetic-textarea";
import { Icon } from "@/components/icons";
import { QuestionView } from "@/components/question-view";
import { Alert } from "@/components/ui";

type Bi = { bn: string; en: string };
export type EditorInitial = {
  id: string;
  unitId: string;
  subjectId: string;
  topicId: string | null;
  language: Language;
  text: Bi;
  options: (Bi & { isCorrect: boolean })[];
  explanation: Bi;
  difficulty: Difficulty;
  tags: string[];
  imageId: string | null;
};

const emptyOption = () => ({ bn: "", en: "", isCorrect: false });

export function QuestionEditor({ taxonomy, initial, base }: { taxonomy: TaxonomyTree; initial?: EditorInitial; base: string }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initial?.language ?? "BN");
  const [unitId, setUnitId] = useState(initial?.unitId ?? taxonomy[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [topicId, setTopicId] = useState(initial?.topicId ?? "");
  const [text, setText] = useState<Bi>(initial?.text ?? { bn: "", en: "" });
  const [options, setOptions] = useState(initial?.options ?? [emptyOption(), emptyOption(), emptyOption(), emptyOption()]);
  const [multi, setMulti] = useState((initial?.options.filter((o) => o.isCorrect).length ?? 0) > 1);
  const [explanation, setExplanation] = useState<Bi>(initial?.explanation ?? { bn: "", en: "" });
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "MEDIUM");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [image, setImage] = useState<string | null>(initial?.imageId ?? null);
  const [phonetic, setPhonetic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const unit = taxonomy.find((u) => u.id === unitId);
  const subject = unit?.subjects.find((s) => s.id === subjectId);
  const showBn = language !== "EN";
  const showEn = language !== "BN";

  const input = useMemo(
    () => ({
      language,
      text: { bn: showBn ? text.bn : null, en: showEn ? text.en : null },
      options: options.map((o) => ({ bn: showBn ? o.bn : null, en: showEn ? o.en : null, isCorrect: o.isCorrect })),
      explanation: { bn: showBn ? explanation.bn : null, en: showEn ? explanation.en : null },
      difficulty,
      tags: parseTags(tags),
    }),
    [language, text, options, explanation, difficulty, tags, showBn, showEn],
  );

  const preview = useMemo(
    () =>
      renderQuestion(
        {
          textBn: input.text.bn,
          textEn: input.text.en,
          imageId: image,
          explanationBn: input.explanation.bn,
          explanationEn: input.explanation.en,
          options: input.options.map((o, i) => ({ id: String(i), textBn: o.bn, textEn: o.en })),
        },
        { explanation: true },
      ),
    [input, image],
  );

  const formulaProblems = useMemo(
    () => [input.text.bn, input.text.en, input.explanation.bn, input.explanation.en, ...input.options.flatMap((o) => [o.bn, o.en])].flatMap(mathErrors),
    [input],
  );

  function setCorrect(i: number) {
    setOptions((prev) => prev.map((o, j) => ({ ...o, isCorrect: multi ? (j === i ? !o.isCorrect : o.isCorrect) : j === i })));
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", "image");
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setImage(data.file.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save(addAnother: boolean) {
    setError(null);
    setWarning(null);
    if (!subjectId) return setError("Choose a subject.");
    const problems = validateQuestion(input, { allowMultiple: multi });
    if (problems.length) return setError(problems.join(" "));
    setPending(true);
    try {
      const body = { ...input, subjectId, topicId: topicId || null, imageId: image };
      const res = initial
        ? await api<{ warning?: string }>(`/api/questions/${initial.id}`, { method: "PATCH", body })
        : await api<{ warning?: string }>("/api/questions", { body });
      if (addAnother) {
        setText({ bn: "", en: "" });
        setOptions([emptyOption(), emptyOption(), emptyOption(), emptyOption()]);
        setExplanation({ bn: "", en: "" });
        setImage(null);
        setWarning(res.warning ? `Saved. ${res.warning}` : null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      } else {
        router.push(`${base}/questions`);
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const bnField = (value: string, onValue: (v: string) => void, rows: number, placeholder: string) => (
    <PhoneticTextarea lang="bn" rows={rows} value={value} onValue={onValue} phonetic={phonetic} placeholder={placeholder} />
  );
  const enField = (value: string, onValue: (v: string) => void, rows: number, placeholder: string) => (
    <textarea lang="en" rows={rows} value={value} onChange={(e) => onValue(e.target.value)} className="input leading-relaxed" placeholder={placeholder} />
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        {warning && <Alert tone="warning">{warning}</Alert>}

        <Section title="Content language">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line-strong bg-surface-2 p-1" role="radiogroup" aria-label="Content language">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={language === l}
                onClick={() => setLanguage(l)}
                className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${language === l ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
              >
                {LANGUAGE_LABEL[l]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-subtle">
            Students see exactly this: {language === "BOTH" ? "Bangla first, with English directly below." : `${LANGUAGE_LABEL[language]} only.`} Use $…$ for formulas, e.g. $x^2$ or $H_2O$.
          </p>
          {showBn && (
            <label className="mt-3 flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={phonetic} onChange={(e) => setPhonetic(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Phonetic Bangla typing <span className="text-subtle">(type “amar sonar bangla”, then space)</span>
            </label>
          )}
        </Section>

        <Section title="Placement">
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
        </Section>

        <Section title="Question">
          <div className="space-y-3">
            {showBn && <Field label="Bangla">{bnField(text.bn, (v) => setText({ ...text, bn: v }), 3, "Question in Bangla…")}</Field>}
            {showEn && <Field label="English">{enField(text.en, (v) => setText({ ...text, en: v }), 3, "Question in English…")}</Field>}
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn btn-secondary min-h-9 cursor-pointer py-1.5 text-xs">
                <Icon name="upload" className="size-4" /> {uploading ? "Uploading…" : image ? "Replace image" : "Add image"}
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
              </label>
              {image && <button type="button" className="btn btn-ghost min-h-9 py-1.5 text-xs text-danger" onClick={() => setImage(null)}>Remove image</button>}
            </div>
          </div>
        </Section>

        <Section
          title="Options"
          aside={
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={multi}
                onChange={(e) => {
                  setMulti(e.target.checked);
                  if (!e.target.checked) {
                    const first = options.findIndex((o) => o.isCorrect);
                    setOptions(options.map((o, i) => ({ ...o, isCorrect: i === first })));
                  }
                }}
                className="size-4 accent-[var(--accent)]"
              />
              Multiple correct answers
            </label>
          }
        >
          <ul className="space-y-3">
            {options.map((o, i) => (
              <li key={i} className={`rounded-xl border p-3 ${o.isCorrect ? "border-success/50 bg-success-soft/40" : "border-line"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Option {OPTION_LETTERS[i]}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCorrect(i)}
                      aria-pressed={o.isCorrect}
                      className={`btn min-h-8 px-2.5 py-1 text-xs ${o.isCorrect ? "bg-success text-black" : "btn-ghost"}`}
                    >
                      <Icon name="check" className="size-3.5" /> {o.isCorrect ? "Correct" : "Mark correct"}
                    </button>
                    {options.length > 2 && (
                      <button type="button" className="btn btn-ghost min-h-8 px-2 py-1 text-danger" aria-label={`Remove option ${OPTION_LETTERS[i]}`} onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                        <Icon name="trash" className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className={`grid gap-2 ${showBn && showEn ? "sm:grid-cols-2" : ""}`}>
                  {showBn && bnField(o.bn, (v) => setOptions(options.map((x, j) => (j === i ? { ...x, bn: v } : x))), 1, "Bangla")}
                  {showEn && enField(o.en, (v) => setOptions(options.map((x, j) => (j === i ? { ...x, en: v } : x))), 1, "English")}
                </div>
              </li>
            ))}
          </ul>
          {options.length < MAX_OPTIONS && (
            <button type="button" className="btn btn-ghost mt-3 text-sm" onClick={() => setOptions([...options, emptyOption()])}>
              <Icon name="plus" className="size-4" /> Add option
            </button>
          )}
        </Section>

        <Section title="Explanation (optional)">
          <div className="space-y-3">
            {showBn && bnField(explanation.bn, (v) => setExplanation({ ...explanation, bn: v }), 3, "Explanation in Bangla…")}
            {showEn && enField(explanation.en, (v) => setExplanation({ ...explanation, en: v }), 3, "Explanation in English…")}
          </div>
        </Section>

        <Section title="Details">
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <Field label="Difficulty">
              <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
              </select>
            </Field>
            <Field label="Tags (comma separated)">
              <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. motion, ckb 2023" />
            </Field>
          </div>
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-2 border-t border-line bg-black/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => save(false)}>
            {pending ? "Saving…" : initial ? "Save changes" : "Save question"}
          </button>
          {!initial && (
            <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => save(true)}>
              Save & add another
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>Cancel</button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Student preview</h2>
            <span className="badge border-line-strong text-muted">{LANGUAGE_LABEL[language]}</span>
          </div>
          <div className="p-4">
            <QuestionView data={preview} number={1} multi={input.options.filter((o) => o.isCorrect).length > 1} optionState={(id) => (input.options[Number(id)]?.isCorrect ? "correct" : "idle")} />
          </div>
          {formulaProblems.length > 0 && (
            <div className="border-t border-line p-4">
              <Alert tone="warning">Formula problem: {formulaProblems[0]}</Alert>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
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
