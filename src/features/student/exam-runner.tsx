"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { QuestionView, type QuestionViewData } from "@/components/question-view";

export type RunnerQuestion = { id: string; multi: boolean; view: QuestionViewData };
type Entry = { selected: string[]; marked: boolean };
type SaveState = "saved" | "saving" | "offline";

const storageKey = (id: string) => `nc-attempt-${id}`;

function readPending(id: string): Record<string, Entry> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id)) ?? "{}");
  } catch {
    return {};
  }
}

function writePending(id: string, pending: Record<string, Entry>) {
  try {
    if (Object.keys(pending).length) localStorage.setItem(storageKey(id), JSON.stringify(pending));
    else localStorage.removeItem(storageKey(id));
  } catch {
    /* storage unavailable (private mode) — answers still save to the server */
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ExamRunner({
  attemptId,
  title,
  rule,
  marksPerQuestion,
  deadlineAt,
  serverNow,
  questions,
  initialAnswers,
}: {
  attemptId: string;
  title: string;
  rule: string;
  marksPerQuestion: number;
  deadlineAt: string | null;
  serverNow: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, Entry>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Entry>>(initialAnswers);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState<null | "manual" | "auto">(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Pending (unsynced) answers live in a ref + localStorage so a reload or lost connection loses nothing.
  const pending = useRef<Record<string, Entry>>({});
  const inflight = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);

  // ── Server-anchored timer. performance.now() is monotonic, so changing the device clock has no effect.
  const clock = useRef({ remainingAtAnchor: deadlineAt ? new Date(deadlineAt).getTime() - new Date(serverNow).getTime() : null as number | null, anchor: 0 });
  const [remaining, setRemaining] = useState<number | null>(clock.current.remainingAtAnchor);

  const resync = useCallback((server: { deadlineAt: string | null; serverNow: string }) => {
    if (!server.deadlineAt) return;
    clock.current = { remainingAtAnchor: new Date(server.deadlineAt).getTime() - new Date(server.serverNow).getTime(), anchor: performance.now() };
  }, []);

  const goToResult = useCallback(() => {
    finished.current = true;
    writePending(attemptId, {});
    router.replace(`/student/results/${attemptId}`);
    router.refresh();
  }, [attemptId, router]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (inflight.current) return false;
    const snapshot = { ...pending.current };
    const ids = Object.keys(snapshot);
    if (!ids.length) {
      setSaveState("saved");
      return true;
    }
    inflight.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: ids.map((questionId) => ({ questionId, ...snapshot[questionId] })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.submitted) {
        goToResult();
        return false;
      }
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      // Drop only the entries that haven't changed again while this request was in flight.
      for (const id of ids) if (pending.current[id] === snapshot[id]) delete pending.current[id];
      writePending(attemptId, pending.current);
      resync(data);
      inflight.current = false;
      if (Object.keys(pending.current).length) return flush();
      setSaveState("saved");
      return true;
    } catch {
      inflight.current = false;
      setSaveState("offline");
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void flush(), 3000);
      return false;
    }
  }, [attemptId, goToResult, resync]);

  // Restore unsynced answers from this device (they are newer than the server copy) and push them.
  useEffect(() => {
    clock.current.anchor = performance.now();
    const local = readPending(attemptId);
    if (Object.keys(local).length) {
      pending.current = local;
      setAnswers((prev) => ({ ...prev, ...local }));
      void flush();
    }
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [attemptId, flush]);

  const submit = useCallback(
    async (mode: "manual" | "auto") => {
      if (finished.current) return;
      setSubmitting(mode);
      setSubmitError(null);
      await flush();
      if (Object.keys(pending.current).length && mode === "manual") {
        setSubmitError("Some answers haven't reached the server yet. Check your internet connection and try again.");
        setSubmitting(null);
        return;
      }
      try {
        const res = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto: mode === "auto" }),
        });
        if (!res.ok) throw new Error();
        goToResult();
      } catch {
        if (mode === "auto") {
          // The server finalises expired attempts on its own; keep trying so the student lands on the result.
          setTimeout(() => void submit("auto"), 4000);
        } else {
          setSubmitError("Could not submit. Check your internet connection and try again.");
          setSubmitting(null);
        }
      }
    },
    [attemptId, flush, goToResult],
  );

  // Tick the timer; auto-submit at zero.
  useEffect(() => {
    if (clock.current.remainingAtAnchor === null) return;
    const tick = () => {
      const left = clock.current.remainingAtAnchor! - (performance.now() - clock.current.anchor);
      setRemaining(left);
      if (left <= 0 && !finished.current && !submitting) void submit("auto");
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [submit, submitting]);

  // After the tab sleeps (phone locked), re-read the deadline from the server.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible" || finished.current) return;
      try {
        const res = await fetch(`/api/attempts/${attemptId}`);
        const data = await res.json();
        if (data.status === "SUBMITTED") return goToResult();
        resync(data);
      } catch {
        /* offline: keep local timer */
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [attemptId, goToResult, resync]);

  // Warn before leaving only if something hasn't been saved yet.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length && !finished.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function update(qid: string, entry: Entry) {
    setAnswers((prev) => ({ ...prev, [qid]: entry }));
    pending.current = { ...pending.current, [qid]: entry };
    writePending(attemptId, pending.current);
    void flush();
  }

  const q = questions[index];
  const entry = answers[q.id] ?? { selected: [], marked: false };

  function select(optionId: string) {
    if (submitting) return;
    const has = entry.selected.includes(optionId);
    const selected = q.multi ? (has ? entry.selected.filter((x) => x !== optionId) : [...entry.selected, optionId]) : has ? [] : [optionId];
    update(q.id, { ...entry, selected });
  }

  const stats = useMemo(() => {
    let answered = 0;
    let marked = 0;
    for (const item of questions) {
      const a = answers[item.id];
      if (a?.selected.length) answered++;
      if (a?.marked) marked++;
    }
    return { answered, marked, unanswered: questions.length - answered };
  }, [answers, questions]);

  const timeClass =
    remaining === null ? "text-muted" : remaining < 60_000 ? "border-danger/60 bg-danger-soft text-danger animate-pulse" : remaining < 5 * 60_000 ? "border-warning/50 bg-warning-soft text-warning" : "border-line-strong text-fg";

  const palette = (
    <div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((item, i) => {
          const a = answers[item.id];
          const answered = !!a?.selected.length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setIndex(i);
                setPaletteOpen(false);
              }}
              aria-label={`Question ${i + 1}${answered ? ", answered" : ", not answered"}${a?.marked ? ", marked for review" : ""}`}
              aria-current={i === index ? "step" : undefined}
              className={`relative grid aspect-square place-items-center rounded-lg border text-sm font-semibold tabular-nums transition-colors ${
                answered ? "border-success/50 bg-success text-black" : a?.marked ? "border-warning/60 bg-warning-soft text-warning" : "border-line-strong bg-surface-3 text-muted"
              } ${i === index ? "ring-2 ring-accent ring-offset-2 ring-offset-black" : ""}`}
            >
              {i + 1}
              {a?.marked && answered && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border border-black bg-warning" />}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
        <li className="flex items-center gap-2"><span className="size-3.5 rounded bg-success" /> Answered ({stats.answered})</li>
        <li className="flex items-center gap-2"><span className="size-3.5 rounded border border-line-strong bg-surface-3" /> Not answered ({stats.unanswered})</li>
        <li className="flex items-center gap-2"><span className="size-3.5 rounded border border-warning/60 bg-warning-soft" /> Marked ({stats.marked})</li>
        <li className="flex items-center gap-2"><span className="size-3.5 rounded ring-2 ring-accent" /> Current</li>
      </ul>
    </div>
  );

  return (
    <div className="min-h-dvh pb-24 lg:pb-8">
      <header className="sticky top-0 z-20 border-b border-line bg-black/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-subtle">
              <span
                className={`inline-block size-1.5 rounded-full ${saveState === "saved" ? "bg-success" : saveState === "saving" ? "bg-warning" : "bg-danger"}`}
                aria-hidden="true"
              />
              <span role="status">{saveState === "saved" ? "All answers saved" : saveState === "saving" ? "Saving…" : "Offline: answers kept on this device"}</span>
            </div>
          </div>
          <div className={`rounded-lg border px-2.5 py-1 font-mono text-base font-bold tabular-nums ${timeClass}`} aria-live="off" aria-label="Time remaining">
            {remaining === null ? "Untimed" : formatClock(remaining)}
          </div>
          <button type="button" className="btn btn-primary min-h-9 px-3 py-1.5" onClick={() => setConfirmOpen(true)} disabled={!!submitting}>
            Submit
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="font-semibold text-fg">
              Question {index + 1} <span className="text-muted">of {questions.length}</span>
            </span>
            <span>
              {marksPerQuestion} mark{marksPerQuestion === 1 ? "" : "s"} · {rule}
            </span>
          </div>
          <div className="card p-4 sm:p-6">
            <QuestionView
              data={q.view}
              multi={q.multi}
              onSelect={select}
              disabled={!!submitting}
              optionState={(id) => (entry.selected.includes(id) ? "selected" : "idle")}
            />
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-black/95 px-3 py-2.5 backdrop-blur lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-6xl items-center gap-2">
              <button type="button" className="btn btn-secondary px-3" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Previous question">
                ←<span className="hidden sm:inline">Previous</span>
              </button>
              <button
                type="button"
                className={`btn flex-1 px-2 sm:flex-none sm:px-4 ${entry.marked ? "border border-warning/60 bg-warning-soft text-warning" : "btn-secondary"}`}
                onClick={() => update(q.id, { ...entry, marked: !entry.marked })}
                aria-pressed={entry.marked}
              >
                {entry.marked ? "Marked" : "Mark for review"}
              </button>
              <button type="button" className="btn btn-ghost px-2 sm:px-4" onClick={() => update(q.id, { ...entry, selected: [] })} disabled={!entry.selected.length}>
                Clear
              </button>
              <button type="button" className="btn btn-secondary px-3 lg:hidden" onClick={() => setPaletteOpen(true)} aria-label="Open question palette">
                <Icon name="menu" className="size-5" />
              </button>
              <button
                type="button"
                className="btn btn-primary px-3 sm:ml-auto"
                onClick={() => (index < questions.length - 1 ? setIndex(index + 1) : setConfirmOpen(true))}
              >
                {index < questions.length - 1 ? <>Next<span aria-hidden="true">→</span></> : "Finish"}
              </button>
            </div>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="card sticky top-20 p-4">
            <h2 className="mb-3 text-sm font-semibold">Questions</h2>
            {palette}
          </div>
        </aside>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/70 lg:hidden" onClick={() => setPaletteOpen(false)}>
          <div className="max-h-[75dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line-strong bg-surface p-4 pb-8" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Question palette">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Questions</h2>
              <button type="button" className="btn btn-ghost min-h-9 px-2" onClick={() => setPaletteOpen(false)} aria-label="Close palette">
                <Icon name="close" />
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}

      <Modal open={confirmOpen && !submitting} onClose={() => setConfirmOpen(false)} title="Submit exam?">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-success/30 bg-success-soft p-3">
            <dt className="text-xs text-success">Answered</dt>
            <dd className="text-2xl font-bold text-success tabular-nums">{stats.answered}</dd>
          </div>
          <div className="rounded-xl border border-line-strong bg-surface-2 p-3">
            <dt className="text-xs text-muted">Unanswered</dt>
            <dd className="text-2xl font-bold tabular-nums">{stats.unanswered}</dd>
          </div>
          <div className="rounded-xl border border-warning/30 bg-warning-soft p-3">
            <dt className="text-xs text-warning">Marked</dt>
            <dd className="text-2xl font-bold text-warning tabular-nums">{stats.marked}</dd>
          </div>
        </dl>
        {stats.unanswered > 0 && <p className="mt-4 text-sm text-muted">You have {stats.unanswered} unanswered question(s). Skipped questions get 0 marks.</p>}
        {submitError && <p className="mt-3 text-sm text-danger">{submitError}</p>}
        <p className="mt-3 text-sm text-muted">You can&apos;t change answers after submitting.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>Keep working</button>
          <button type="button" className="btn btn-primary" onClick={() => submit("manual")}>Submit now</button>
        </div>
      </Modal>

      {submitting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 px-6 text-center" role="alertdialog" aria-live="assertive">
          <div>
            <span className="mx-auto block size-10 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            <p className="mt-4 text-lg font-semibold">{submitting === "auto" ? "Time is up. Submitting your answers…" : "Submitting…"}</p>
            {submitError && <p className="mt-2 text-sm text-danger">{submitError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
