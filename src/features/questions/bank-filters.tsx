"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { DIFFICULTIES, DIFFICULTY_LABEL, LANGUAGES, LANGUAGE_LABEL } from "@/lib/question-content";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";

export function BankFilters({ taxonomy, base }: { taxonomy: TaxonomyTree; base: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [f, setF] = useState({
    q: sp.get("q") ?? "",
    unit: sp.get("unit") ?? "",
    subject: sp.get("subject") ?? "",
    topic: sp.get("topic") ?? "",
    difficulty: sp.get("difficulty") ?? "",
    language: sp.get("language") ?? "",
    tag: sp.get("tag") ?? "",
    mine: sp.get("mine") ?? "",
  });
  const unit = taxonomy.find((u) => u.id === f.unit);
  const subject = unit?.subjects.find((s) => s.id === f.subject);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    router.push(`${pathname || base + "/questions"}?${params}`);
  }

  const active = Object.values(f).some(Boolean);

  return (
    <form onSubmit={submit} className="card mb-4 space-y-3 p-3" role="search">
      <div className="flex gap-2">
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search in Bangla or English…" className="input" aria-label="Search questions" />
        <button className="btn btn-primary shrink-0"><Icon name="search" className="size-4" /><span className="hidden sm:inline">Search</span></button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <select className="input text-sm" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value, subject: "", topic: "" })} aria-label="Unit">
          <option value="">All units</option>
          {taxonomy.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="input text-sm" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, topic: "" })} disabled={!unit} aria-label="Subject">
          <option value="">All subjects</option>
          {unit?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="input text-sm" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} disabled={!subject} aria-label="Topic">
          <option value="">All topics</option>
          <option value="none">No topic</option>
          {subject?.topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input text-sm" value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })} aria-label="Difficulty">
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
        </select>
        <select className="input text-sm" value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} aria-label="Language">
          <option value="">Any language</option>
          {LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
        </select>
        <input className="input text-sm" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="Tag" aria-label="Tag" />
        <label className="flex items-center gap-2 px-1 text-sm text-muted">
          <input type="checkbox" checked={f.mine === "1"} onChange={(e) => setF({ ...f, mine: e.target.checked ? "1" : "" })} className="size-4 accent-[var(--accent)]" />
          Only mine
        </label>
      </div>
      {active && (
        <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => router.push(pathname)}>
          Clear filters
        </button>
      )}
    </form>
  );
}
