"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { DIFFICULTIES, DIFFICULTY_LABEL, LANGUAGE_LABEL, type Difficulty, type Language } from "@/lib/question-content";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { BiBlock, QuestionView, type QuestionViewData } from "@/components/question-view";
import { Alert } from "@/components/ui";

export type BankRow = {
  id: string;
  language: Language;
  difficulty: Difficulty;
  tags: string[];
  place: string;
  author: string;
  editable: boolean;
  view: QuestionViewData;
  correct: string[];
};

export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  EASY: "border-success/30 text-success",
  MEDIUM: "border-warning/30 text-warning",
  HARD: "border-danger/30 text-danger",
};

export function BankList({ rows, taxonomy }: { rows: BankRow[]; taxonomy: TaxonomyTree }) {
  const router = useRouter();
  const pathname = usePathname();
  const base = pathname.replace(/\/questions.*$/, "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [bulk, setBulk] = useState<"delete" | "topic" | "difficulty" | null>(null);
  const [topicId, setTopicId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const editable = rows.filter((r) => r.editable);
  const allSelected = editable.length > 0 && editable.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function run(action: "delete" | "topic" | "difficulty", ids: string[]) {
    setPending(true);
    setNotice(null);
    try {
      const res = await api<{ deleted?: number; archived?: number; updated?: number; skipped?: number }>("/api/questions/bulk", {
        body: { action, ids, ...(action === "topic" ? { topicId } : {}), ...(action === "difficulty" ? { difficulty } : {}) },
      });
      const parts =
        action === "delete"
          ? [`${(res.deleted ?? 0) + (res.archived ?? 0)} question(s) deleted`]
          : [`${res.updated ?? 0} question(s) updated`];
      if (res.archived) parts.push(`${res.archived} kept in past exams`);
      if (res.skipped) parts.push(`${res.skipped} skipped (not yours)`);
      setNotice({ tone: "success", text: parts.join(" · ") + "." });
      setSelected(new Set());
      setBulk(null);
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 px-1 text-sm text-muted">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={allSelected}
            disabled={!editable.length}
            onChange={() => setSelected(allSelected ? new Set() : new Set(editable.map((r) => r.id)))}
          />
          {selected.size ? `${selected.size} selected` : "Select all"}
        </label>
        {selected.size > 0 && (
          <>
            <button type="button" className="btn btn-secondary min-h-9 py-1.5 text-xs" onClick={() => setBulk("topic")}>Change topic</button>
            <button type="button" className="btn btn-secondary min-h-9 py-1.5 text-xs" onClick={() => setBulk("difficulty")}>Change difficulty</button>
            <button type="button" className="btn btn-danger min-h-9 py-1.5 text-xs" onClick={() => setBulk("delete")}>Delete</button>
          </>
        )}
      </div>
      {notice && <div className="mb-3"><Alert tone={notice.tone}>{notice.text}</Alert></div>}

      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.id} className="card overflow-hidden">
            <div className="flex gap-3 p-4">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                disabled={!r.editable}
                aria-label="Select question"
                title={r.editable ? undefined : "You can only change your own questions"}
              />
              <div className="min-w-0 flex-1">
                <button type="button" className="w-full text-left" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <BiBlock html={r.view.text} className={open === r.id ? "" : "line-clamp-3"} />
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="badge border-line-strong text-muted">{LANGUAGE_LABEL[r.language]}</span>
                  <span className={`badge ${DIFFICULTY_STYLE[r.difficulty]}`}>{DIFFICULTY_LABEL[r.difficulty]}</span>
                  {r.view.imageUrl && <span className="badge border-line-strong text-muted">Image</span>}
                  <span className="text-subtle">{r.place}</span>
                  {r.tags.map((t) => <span key={t} className="badge border-accent/25 text-accent-text">#{t}</span>)}
                  <span className="text-subtle">· by {r.author}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
                {r.editable && (
                  <Link href={`${base}/questions/${r.id}`} className="btn btn-ghost min-h-9 px-2.5 py-1.5 text-xs">Edit</Link>
                )}
                {r.editable && (
                  <button type="button" className="btn btn-ghost min-h-9 px-2.5 py-1.5 text-danger" aria-label="Delete question" onClick={() => { setSelected(new Set([r.id])); setBulk("delete"); }}>
                    <Icon name="trash" className="size-4" />
                  </button>
                )}
              </div>
            </div>
            {open === r.id && (
              <div className="border-t border-line bg-black/40 p-4">
                <QuestionView data={{ ...r.view, text: { bn: null, en: null } }} optionState={(id) => (r.correct.includes(id) ? "correct" : "idle")} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal open={bulk === "delete"} onClose={() => setBulk(null)} title="Delete questions">
        <p className="text-sm text-muted">
          Delete {selected.size} question(s)? Questions already used in exams are kept for those exams&apos; results but removed from the bank.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setBulk(null)}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={pending} onClick={() => run("delete", [...selected])}>{pending ? "Deleting…" : "Delete"}</button>
        </div>
      </Modal>

      <Modal open={bulk === "topic"} onClose={() => setBulk(null)} title="Change topic">
        <label className="label" htmlFor="bulk-topic">Move {selected.size} question(s) to</label>
        <select id="bulk-topic" className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="">Choose a topic…</option>
          {taxonomy.map((u) =>
            u.subjects.map((s) => (
              <optgroup key={s.id} label={`${u.name} › ${s.name}`}>
                {s.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            )),
          )}
        </select>
        <p className="mt-2 text-xs text-subtle">Questions also move to the topic&apos;s subject.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setBulk(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending || !topicId} onClick={() => run("topic", [...selected])}>Apply</button>
        </div>
      </Modal>

      <Modal open={bulk === "difficulty"} onClose={() => setBulk(null)} title="Change difficulty">
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)} className={`btn ${difficulty === d ? "btn-primary" : "btn-secondary"}`}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setBulk(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run("difficulty", [...selected])}>Apply to {selected.size}</button>
        </div>
      </Modal>
    </>
  );
}
