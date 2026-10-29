"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client-api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";

export type ExamFormValues = {
  title: string;
  type: "FULL_MOCK" | "SUBJECT" | "TOPIC" | "PRACTICE";
  unitId: string;
  instructions: string;
  durationMinutes: string;
  marksPerQuestion: string;
  passMark: string;
  negativeMarking: boolean;
  negativeMark: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanations: boolean;
  allowRetake: boolean;
  schedule: "LIVE" | "ALWAYS";
  startsAt: string;
  endsAt: string;
  resultRelease: "IMMEDIATE" | "AFTER_END";
  audience: "ALL" | "BATCHES";
  batchIds: string[];
  status: "DRAFT" | "PUBLISHED";
  showLeaderboard: boolean;
  leaderboardTopN: string;
};

const TYPES = [
  ["FULL_MOCK", "Full mock"],
  ["SUBJECT", "Subject test"],
  ["TOPIC", "Topic quiz"],
  ["PRACTICE", "Practice (untimed)"],
] as const;
const QUICK_MARKS = ["0.25", "0.50", "1.00"];

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamSettingsForm({
  examId,
  initial: initialValues,
  startsAtIso = null,
  endsAtIso = null,
  units,
  batches,
  base,
  locked,
  questionCount,
}: {
  examId?: string;
  initial: ExamFormValues;
  startsAtIso?: string | null;
  endsAtIso?: string | null;
  units: { id: string; name: string }[];
  batches: { id: string; name: string }[];
  base: string;
  locked: boolean;
  questionCount: number;
}) {
  const router = useRouter();
  const [v, setV] = useState(initialValues);
  // datetime-local shows the browser's timezone, so convert only after hydration.
  useEffect(() => {
    setV((prev) => ({ ...prev, startsAt: toLocalInput(startsAtIso), endsAt: toLocalInput(endsAtIso) }));
  }, [startsAtIso, endsAtIso]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof ExamFormValues>(k: K, value: ExamFormValues[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setSaved(false);
  };
  const untimed = v.type === "PRACTICE";
  const live = v.schedule === "LIVE";
  const mpq = Number(v.marksPerQuestion) || 0;
  const customMark = !QUICK_MARKS.includes(Number(v.negativeMark || 0).toFixed(2)) || !v.negativeMark;

  async function save(status?: "DRAFT" | "PUBLISHED") {
    setPending(true);
    setError(null);
    setSaved(false);
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    const body = {
      ...v,
      status: status ?? v.status,
      unitId: v.unitId || null,
      durationMinutes: untimed ? null : num(v.durationMinutes),
      marksPerQuestion: Number(v.marksPerQuestion),
      passMark: num(v.passMark),
      negativeMark: v.negativeMarking ? Number(v.negativeMark) : 0,
      startsAt: live && v.startsAt ? new Date(v.startsAt).toISOString() : null,
      endsAt: live && v.endsAt ? new Date(v.endsAt).toISOString() : null,
      leaderboardTopN: num(v.leaderboardTopN),
    };
    try {
      if (examId) {
        await api(`/api/exams/${examId}`, { method: "PATCH", body });
        if (status) set("status", status);
        setSaved(true);
        router.refresh();
      } else {
        const res = await api<{ exam: { id: string } }>("/api/exams", { body });
        router.push(`${base}/exams/${res.exam.id}?tab=questions`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Exam saved.</Alert>}
      {locked && (
        <Alert tone="warning">Students have already started this exam, so negative marking, marks per question and the question list are locked.</Alert>
      )}

      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input className="input" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. BUET Model Test 03" />
          </Field>
          <Field label="Exam type">
            <select className="input" value={v.type} onChange={(e) => set("type", e.target.value as ExamFormValues["type"])}>
              {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <select className="input" value={v.unitId} onChange={(e) => set("unitId", e.target.value)}>
              <option value="">Not set</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Duration (minutes)">
            <input className="input" inputMode="numeric" value={untimed ? "" : v.durationMinutes} disabled={untimed} placeholder={untimed ? "Untimed" : "60"} onChange={(e) => set("durationMinutes", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Marks per question">
            <input className="input" inputMode="decimal" value={v.marksPerQuestion} disabled={locked} onChange={(e) => set("marksPerQuestion", e.target.value)} />
          </Field>
          <Field label="Total marks">
            <div className="input bg-surface-3 text-muted">
              {questionCount ? `${+(questionCount * mpq).toFixed(2)} (${questionCount} questions × ${mpq})` : "Add questions to calculate"}
            </div>
          </Field>
          <Field label="Pass mark (optional)">
            <input className="input" inputMode="decimal" value={v.passMark} onChange={(e) => set("passMark", e.target.value)} placeholder="e.g. 40" />
          </Field>
        </div>
      </Card>

      <Card title="Negative marking">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted">
            {v.negativeMarking
              ? `Each wrong answer loses ${Number(v.negativeMark || 0).toFixed(2)} marks. Skipped questions are never penalised.`
              : "Off. Wrong answers lose nothing."}
          </p>
          <Switch checked={v.negativeMarking} disabled={locked} onChange={(c) => set("negativeMarking", c)} label="Negative marking" />
        </div>
        {v.negativeMarking && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {QUICK_MARKS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={locked}
                onClick={() => set("negativeMark", m)}
                className={`btn min-h-10 px-4 ${Number(v.negativeMark).toFixed(2) === m ? "btn-primary" : "btn-secondary"}`}
              >
                {m}
              </button>
            ))}
            <label className={`flex items-center gap-2 rounded-xl border px-3 ${customMark ? "border-accent" : "border-line-strong"}`}>
              <span className="text-sm text-muted">Custom</span>
              <input
                className="w-20 bg-transparent py-2 text-sm outline-none"
                inputMode="decimal"
                disabled={locked}
                value={customMark ? v.negativeMark : ""}
                placeholder="0.20"
                onChange={(e) => set("negativeMark", e.target.value.replace(/[^\d.]/g, ""))}
                aria-label="Custom deduction per wrong answer"
              />
            </label>
          </div>
        )}
        {locked && <p className="mt-3 flex items-center gap-1.5 text-xs text-warning"><Icon name="key" className="size-3.5" /> Locked: students have started this exam.</p>}
      </Card>

      <Card title="Schedule & audience">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Availability">
            <Segmented value={v.schedule} onChange={(x) => set("schedule", x as ExamFormValues["schedule"])} options={[["ALWAYS", "Always available"], ["LIVE", "Live (fixed window)"]]} />
          </Field>
          <Field label="Who can take it">
            <Segmented value={v.audience} onChange={(x) => set("audience", x as ExamFormValues["audience"])} options={[["ALL", "Everyone"], ["BATCHES", "Specific batches"]]} />
          </Field>
          {live && (
            <>
              <Field label="Starts (your local time)">
                <input type="datetime-local" className="input" value={v.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </Field>
              <Field label="Ends (your local time)">
                <input type="datetime-local" className="input" value={v.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              </Field>
              <Field label="Show results" className="sm:col-span-2">
                <Segmented
                  value={v.resultRelease}
                  onChange={(x) => set("resultRelease", x as ExamFormValues["resultRelease"])}
                  options={[["IMMEDIATE", "Right after submitting"], ["AFTER_END", "After the exam window ends"]]}
                />
                <p className="mt-1.5 text-xs text-subtle">For live exams the answer review (correct answers) always opens after the window ends, so early finishers can&apos;t share answers.</p>
              </Field>
            </>
          )}
          {v.audience === "BATCHES" && (
            <div className="sm:col-span-2">
              <span className="label">Batches</span>
              {batches.length ? (
                <div className="flex flex-wrap gap-2">
                  {batches.map((b) => {
                    const on = v.batchIds.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("batchIds", on ? v.batchIds.filter((x) => x !== b.id) : [...v.batchIds, b.id])}
                        className={`btn min-h-9 px-3 py-1.5 text-xs ${on ? "btn-primary" : "btn-secondary"}`}
                      >
                        {on && <Icon name="check" className="size-3.5" />} {b.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No batches exist yet.</p>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card title="Options">
        <div className="divide-y divide-line">
          <Toggle label="Shuffle questions" hint="Each student gets a different question order." checked={v.shuffleQuestions} onChange={(c) => set("shuffleQuestions", c)} />
          <Toggle label="Shuffle options" hint="A/B/C/D order differs per student." checked={v.shuffleOptions} onChange={(c) => set("shuffleOptions", c)} />
          <Toggle label="Show explanations after the exam" checked={v.showExplanations} onChange={(c) => set("showExplanations", c)} />
          <Toggle
            label="Allow retake"
            hint={live ? "Live exams always allow one attempt." : "Students may take the exam again; rankings use the first attempt."}
            checked={live ? false : v.allowRetake}
            disabled={live}
            onChange={(c) => set("allowRetake", c)}
          />
          <Toggle label="Show leaderboard" checked={v.showLeaderboard} onChange={(c) => set("showLeaderboard", c)} />
          {v.showLeaderboard && (
            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-sm font-medium">Show only the top N</div>
                <div className="text-xs text-subtle">Leave empty to show everyone.</div>
              </div>
              <input className="input w-24" inputMode="numeric" value={v.leaderboardTopN} onChange={(e) => set("leaderboardTopN", e.target.value.replace(/\D/g, ""))} placeholder="All" />
            </div>
          )}
        </div>
      </Card>

      <Card title="Instructions for students">
        <textarea
          rows={5}
          className="input"
          value={v.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          placeholder="Shown before the exam starts. Bangla and English are both fine."
        />
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-black/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        {examId ? (
          <>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => save()}>{pending ? "Saving…" : "Save settings"}</button>
            {v.status === "DRAFT" ? (
              <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => save("PUBLISHED")}>Save & publish</button>
            ) : (
              <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => save("DRAFT")}>Unpublish (back to draft)</button>
            )}
            <span className={`badge ml-auto ${v.status === "PUBLISHED" ? "border-success/40 text-success" : "border-line-strong text-muted"}`}>
              {v.status === "PUBLISHED" ? "Published" : "Draft"}
            </span>
          </>
        ) : (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => save("DRAFT")}>
            {pending ? "Creating…" : "Create exam & add questions"}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-line-strong bg-surface-2 p-1" role="radiogroup">
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          role="radio"
          aria-checked={value === val}
          onClick={() => onChange(val)}
          className={`min-h-9 rounded-lg px-2 text-sm font-medium transition-colors ${value === val ? "bg-accent text-white" : "text-muted hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (c: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3"}`}
    >
      <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (c: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-subtle">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}
