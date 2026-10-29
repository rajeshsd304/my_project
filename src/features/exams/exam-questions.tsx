"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/question-content";
import { renderRich } from "@/lib/rich";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";
import { Alert, EmptyState } from "@/components/ui";
import { DIFFICULTY_STYLE } from "../questions/bank-list";

export type PickedQuestion = {
  id: string;
  textBn: string | null;
  textEn: string | null;
  difficulty: string;
  place: string;
  archived?: boolean;
};

type ApiQuestion = {
  id: string;
  textBn: string | null;
  textEn: string | null;
  difficulty: string;
  subject: { name: string; unit: { name: string } };
  topic: { name: string } | null;
};

const toPicked = (q: ApiQuestion): PickedQuestion => ({
  id: q.id,
  textBn: q.textBn,
  textEn: q.textEn,
  difficulty: q.difficulty,
  place: [q.subject.name, q.topic?.name].filter(Boolean).join(" › "),
});

function Snippet({ q }: { q: Pick<PickedQuestion, "textBn" | "textEn"> }) {
  return (
    <div className="min-w-0 text-sm leading-relaxed">
      {q.textBn && <div className="rich line-clamp-2" dangerouslySetInnerHTML={{ __html: renderRich(q.textBn) }} />}
      {q.textEn && <div className={`rich line-clamp-2 ${q.textBn ? "text-muted" : ""}`} dangerouslySetInnerHTML={{ __html: renderRich(q.textEn) }} />}
    </div>
  );
}

export function ExamQuestions({ examId, initial, taxonomy, locked, marksPerQuestion }: { examId: string; initial: PickedQuestion[]; taxonomy: TaxonomyTree; locked: boolean; marksPerQuestion: number }) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [status, setStatus] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setList(initial), [initial]);

  async function persist(next: PickedQuestion[]) {
    const prev = list;
    setList(next);
    setSaving(true);
    setStatus(null);
    try {
      await api(`/api/exams/${examId}/questions`, { method: "PUT", body: { questionIds: next.map((q) => q.id) } });
      router.refresh();
    } catch (err) {
      setList(prev);
      setStatus({ tone: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    persist(next);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            In this exam <span className="text-muted">({list.length} · {+(list.length * marksPerQuestion).toFixed(2)} marks)</span>
          </h2>
          {saving && <span className="text-xs text-subtle">Saving…</span>}
        </div>
        {locked && <div className="mb-3"><Alert tone="warning">Locked: students have already started this exam.</Alert></div>}
        {status && <div className="mb-3"><Alert tone={status.tone}>{status.text}</Alert></div>}
        {list.length === 0 ? (
          <EmptyState icon="clipboard" title="No questions yet">Add questions from the bank or pick them randomly.</EmptyState>
        ) : (
          <ol className="space-y-2">
            {list.map((q, i) => (
              <li key={q.id} className="card flex items-start gap-3 p-3">
                <span className="w-6 shrink-0 pt-0.5 text-right text-sm font-semibold text-accent-text tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Snippet q={q} />
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <span className={`badge ${DIFFICULTY_STYLE[q.difficulty as Difficulty]}`}>{DIFFICULTY_LABEL[q.difficulty as Difficulty]}</span>
                    <span className="text-subtle">{q.place}</span>
                    {q.archived && <span className="badge border-warning/40 text-warning">Removed from bank</span>}
                  </div>
                </div>
                {!locked && (
                  <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                    <button type="button" className="btn btn-ghost min-h-8 px-1.5 py-1" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="btn btn-ghost min-h-8 px-1.5 py-1" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="btn btn-ghost min-h-8 px-1.5 py-1 text-danger" onClick={() => persist(list.filter((x) => x.id !== q.id))} aria-label="Remove">
                      <Icon name="close" className="size-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {!locked && (
        <section className="space-y-4">
          <RandomPicker examId={examId} taxonomy={taxonomy} onDone={(text, tone) => { setStatus({ tone, text }); router.refresh(); }} />
          <BankPicker taxonomy={taxonomy} exclude={list.map((q) => q.id)} onAdd={(qs) => persist([...list, ...qs])} />
        </section>
      )}
    </div>
  );
}

function PlaceSelects({ taxonomy, value, onChange }: { taxonomy: TaxonomyTree; value: { unitId: string; subjectId: string; topicId: string }; onChange: (v: { unitId: string; subjectId: string; topicId: string }) => void }) {
  const unit = taxonomy.find((u) => u.id === value.unitId);
  const subject = unit?.subjects.find((s) => s.id === value.subjectId);
  return (
    <>
      <select className="input text-sm" value={value.unitId} onChange={(e) => onChange({ unitId: e.target.value, subjectId: "", topicId: "" })} aria-label="Unit">
        <option value="">All units</option>
        {taxonomy.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <select className="input text-sm" value={value.subjectId} disabled={!unit} onChange={(e) => onChange({ ...value, subjectId: e.target.value, topicId: "" })} aria-label="Subject">
        <option value="">All subjects</option>
        {unit?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select className="input text-sm" value={value.topicId} disabled={!subject} onChange={(e) => onChange({ ...value, topicId: e.target.value })} aria-label="Topic">
        <option value="">All topics</option>
        {subject?.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </>
  );
}

function RandomPicker({ examId, taxonomy, onDone }: { examId: string; taxonomy: TaxonomyTree; onDone: (text: string, tone: "success" | "error") => void }) {
  const [place, setPlace] = useState({ unitId: "", subjectId: "", topicId: "" });
  const [difficulty, setDifficulty] = useState("");
  const [count, setCount] = useState("10");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api<{ added: number; available: number }>(`/api/exams/${examId}/random`, {
        body: { ...place, unitId: place.unitId || null, subjectId: place.subjectId || null, topicId: place.topicId || null, difficulty: difficulty || null, count: Number(count) || 1 },
      });
      onDone(`Added ${res.added} random question(s)${res.added < Number(count) ? ` (only ${res.available} matched)` : ""}.`, "success");
    } catch (err) {
      onDone((err as Error).message, "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold"><Icon name="layers" className="size-4 text-accent-text" /> Pick randomly</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <PlaceSelects taxonomy={taxonomy} value={place} onChange={setPlace} />
        <select className="input text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </select>
        <input className="input text-sm" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} aria-label="How many" placeholder="How many" />
        <button className="btn btn-secondary" disabled={pending}>{pending ? "Adding…" : `Add ${count || 0}`}</button>
      </div>
    </form>
  );
}

function BankPicker({ taxonomy, exclude, onAdd }: { taxonomy: TaxonomyTree; exclude: string[]; onAdd: (qs: PickedQuestion[]) => void }) {
  const [place, setPlace] = useState({ unitId: "", subjectId: "", topicId: "" });
  const [difficulty, setDifficulty] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ApiQuestion[] | null>(null);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function search(nextSkip = 0) {
    setError(null);
    const params = new URLSearchParams({ take: "15", skip: String(nextSkip), exclude: exclude.join(",") });
    if (q) params.set("q", q);
    if (place.unitId) params.set("unitId", place.unitId);
    if (place.subjectId) params.set("subjectId", place.subjectId);
    if (place.topicId) params.set("topicId", place.topicId);
    if (difficulty) params.set("difficulty", difficulty);
    try {
      const res = await api<{ questions: ApiQuestion[]; total: number }>(`/api/questions?${params}`);
      setResults(res.questions);
      setTotal(res.total);
      setSkip(nextSkip);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const visible = results?.filter((r) => !exclude.includes(r.id)) ?? [];

  return (
    <div className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold"><Icon name="book" className="size-4 text-accent-text" /> Add from question bank</h3>
      <form onSubmit={(e) => { e.preventDefault(); search(0); }} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input className="input col-span-2 text-sm sm:col-span-3" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in Bangla or English…" />
        <PlaceSelects taxonomy={taxonomy} value={place} onChange={setPlace} />
        <select className="input text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </select>
        <button className="btn btn-secondary col-span-2"><Icon name="search" className="size-4" /> Search</button>
      </form>
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
      {results && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>{total} match{total === 1 ? "" : "es"}</span>
            {visible.length > 1 && (
              <button type="button" className="font-semibold text-accent-text hover:underline" onClick={() => onAdd(visible.map(toPicked))}>
                Add all {visible.length} shown
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {visible.map((r) => (
              <li key={r.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <Snippet q={r} />
                  <div className="mt-1 text-xs text-subtle">
                    {DIFFICULTY_LABEL[r.difficulty as Difficulty]} · {r.subject.name}{r.topic ? ` › ${r.topic.name}` : ""}
                  </div>
                </div>
                <button type="button" className="btn btn-primary min-h-8 shrink-0 px-3 py-1 text-xs" onClick={() => onAdd([toPicked(r)])}>
                  <Icon name="plus" className="size-3.5" /> Add
                </button>
              </li>
            ))}
            {!visible.length && <li className="py-6 text-center text-sm text-muted">No more questions match.</li>}
          </ul>
          {total > 15 && (
            <div className="mt-3 flex justify-between">
              <button type="button" className="btn btn-ghost min-h-9 text-xs" disabled={skip === 0} onClick={() => search(Math.max(0, skip - 15))}>Previous</button>
              <button type="button" className="btn btn-ghost min-h-9 text-xs" disabled={skip + 15 >= total} onClick={() => search(skip + 15)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
