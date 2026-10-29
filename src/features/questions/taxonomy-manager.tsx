"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";

type Kind = "unit" | "subject" | "topic";

/** Admin editor for Unit → Subject → Topic. */
export function TaxonomyManager({ taxonomy, counts }: { taxonomy: TaxonomyTree; counts: Record<string, number> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [openUnit, setOpenUnit] = useState<string | null>(taxonomy[0]?.id ?? null);

  async function call(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const create = (kind: Kind, name: string, parentId?: string) => call(() => api("/api/taxonomy", { body: { kind, name, parentId } }));
  const rename = (kind: Kind, id: string, current: string) => {
    const name = window.prompt(`Rename ${kind}`, current)?.trim();
    if (name && name !== current) call(() => api(`/api/taxonomy/${kind}/${id}`, { method: "PATCH", body: { name } }));
  };
  const remove = (kind: Kind, id: string, name: string) => {
    if (window.confirm(`Delete ${kind} "${name}"?${kind === "topic" ? " Its questions stay in the subject without a topic." : ""}`)) {
      call(() => api(`/api/taxonomy/${kind}/${id}`, { method: "DELETE" }));
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <AddForm placeholder="New unit, e.g. Engineering" onAdd={(n) => create("unit", n)} />
      <ul className="space-y-3">
        {taxonomy.map((u) => (
          <li key={u.id} className="card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3">
              <button type="button" className="flex flex-1 items-center gap-2 text-left font-semibold" onClick={() => setOpenUnit(openUnit === u.id ? null : u.id)} aria-expanded={openUnit === u.id}>
                <Icon name="layers" className="size-4 text-accent-text" /> {u.name}
                <span className="text-xs font-normal text-subtle">{u.subjects.length} subjects</span>
              </button>
              <Actions onRename={() => rename("unit", u.id, u.name)} onDelete={() => remove("unit", u.id, u.name)} />
            </div>
            {openUnit === u.id && (
              <div className="space-y-3 border-t border-line bg-black/30 p-4">
                {u.subjects.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-medium">
                        {s.name} <span className="text-xs text-subtle">· {counts[s.id] ?? 0} questions</span>
                      </span>
                      <Actions onRename={() => rename("subject", s.id, s.name)} onDelete={() => remove("subject", s.id, s.name)} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.topics.map((t) => (
                        <span key={t.id} className="badge gap-1 border-line-strong py-1 text-muted">
                          <button type="button" className="hover:text-fg" onClick={() => rename("topic", t.id, t.name)}>{t.name}</button>
                          <button type="button" className="text-subtle hover:text-danger" aria-label={`Delete topic ${t.name}`} onClick={() => remove("topic", t.id, t.name)}>
                            <Icon name="close" className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2">
                      <AddForm small placeholder="Add topic" onAdd={(n) => create("topic", n, s.id)} />
                    </div>
                  </div>
                ))}
                <AddForm small placeholder="Add subject, e.g. Physics" onAdd={(n) => create("subject", n, u.id)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Actions({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="btn btn-ghost min-h-8 px-2 py-1 text-xs" onClick={onRename}>Rename</button>
      <button type="button" className="btn btn-ghost min-h-8 px-2 py-1 text-danger" onClick={onDelete} aria-label="Delete"><Icon name="trash" className="size-3.5" /></button>
    </div>
  );
}

function AddForm({ placeholder, onAdd, small }: { placeholder: string; onAdd: (name: string) => Promise<void> | void; small?: boolean }) {
  const [name, setName] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName("");
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className={`input ${small ? "py-1.5 text-sm" : ""}`} />
      <button className={`btn btn-secondary shrink-0 ${small ? "min-h-9 py-1.5 text-xs" : ""}`}><Icon name="plus" className="size-4" /> Add</button>
    </form>
  );
}
