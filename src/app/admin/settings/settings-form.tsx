"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/client-api";
import { Alert } from "@/components/ui";
import { Switch } from "@/features/exams/exam-settings-form";

type Settings = {
  institutionName: string;
  allowSelfRegistration: boolean;
  defaultNegativeMarking: boolean;
  defaultNegativeMark: number;
  overallLeaderboardEnabled: boolean;
  overallLeaderboardTopN: number | null;
};

const QUICK = [0.25, 0.5, 1];

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [mark, setMark] = useState(initial.defaultNegativeMark.toFixed(2));
  const [topN, setTopN] = useState(initial.overallLeaderboardTopN ? String(initial.overallLeaderboardTopN) : "");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setValues((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const deduction = Number(mark);
    if (values.defaultNegativeMarking && !(deduction > 0)) {
      setStatus({ tone: "error", text: "Set a default deduction greater than 0, or turn negative marking off." });
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await api("/api/admin/settings", {
        method: "PATCH",
        body: { ...values, defaultNegativeMark: deduction || 0.25, overallLeaderboardTopN: topN ? Number(topN) : null },
      });
      setStatus({ tone: "success", text: "Settings saved." });
      router.refresh();
    } catch (err) {
      setStatus({ tone: "error", text: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      {status && <Alert tone={status.tone}>{status.text}</Alert>}

      <Section title="General">
        <label htmlFor="institutionName" className="label">Institution name</label>
        <input id="institutionName" className="input" value={values.institutionName} onChange={(e) => set("institutionName", e.target.value)} />
        <p className="mt-1.5 text-xs text-subtle">Shown on the home page, result slips and question papers.</p>
      </Section>

      <Section title="Accounts">
        <Row label="Student self-registration" hint="When on, anyone can create a student account from the login page and use it immediately. When off, only admins can create accounts.">
          <Switch checked={values.allowSelfRegistration} onChange={(c) => set("allowSelfRegistration", c)} label="Student self-registration" />
        </Row>
      </Section>

      <Section title="Exam defaults">
        <Row label="Negative marking for new exams" hint="Pre-fills every new exam. It can still be changed per exam until students start it.">
          <Switch checked={values.defaultNegativeMarking} onChange={(c) => set("defaultNegativeMarking", c)} label="Default negative marking" />
        </Row>
        {values.defaultNegativeMarking && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Deduction per wrong answer:</span>
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setMark(q.toFixed(2))} className={`btn min-h-9 px-3 py-1.5 ${Number(mark) === q ? "btn-primary" : "btn-secondary"}`}>
                {q.toFixed(2)}
              </button>
            ))}
            <input className="input w-24 py-1.5" inputMode="decimal" value={mark} onChange={(e) => setMark(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Custom deduction" />
          </div>
        )}
      </Section>

      <Section title="Leaderboard">
        <Row label="Overall leaderboard" hint="Weekly, monthly and all-time rankings across exams. Each exam's own leaderboard is set on the exam.">
          <Switch checked={values.overallLeaderboardEnabled} onChange={(c) => set("overallLeaderboardEnabled", c)} label="Overall leaderboard" />
        </Row>
        {values.overallLeaderboardEnabled && (
          <Row label="Show only the top N" hint="Leave empty to show everyone. Students always see their own position.">
            <input className="input w-24" inputMode="numeric" value={topN} onChange={(e) => setTopN(e.target.value.replace(/\D/g, ""))} placeholder="All" aria-label="Top N" />
          </Row>
        )}
      </Section>

      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}
