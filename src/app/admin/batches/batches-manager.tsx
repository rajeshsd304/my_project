"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Alert, EmptyState } from "@/components/ui";

type Batch = { id: string; name: string; description: string | null; students: number };

export function BatchesManager({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Batch | "new" | null>(null);
  const [deleting, setDeleting] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = { name: form.get("name"), description: form.get("description") };
    setPending(true);
    setError(null);
    try {
      if (editing === "new") await api("/api/admin/batches", { body });
      else if (editing) await api(`/api/admin/batches/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setPending(true);
    setError(null);
    try {
      await api(`/api/admin/batches/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const open = (b: Batch | "new") => {
    setError(null);
    setEditing(b);
  };

  return (
    <>
      <div className="mb-4">
        <button type="button" className="btn btn-primary" onClick={() => open("new")}>
          <Icon name="plus" className="size-4" /> New batch
        </button>
      </div>

      {batches.length === 0 ? (
        <EmptyState icon="layers" title="No batches yet">Create a batch, then assign students from the Users page or via CSV import.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => (
            <li key={b.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{b.name}</h2>
                <span className="badge shrink-0 border-accent/30 bg-accent-soft text-accent-text">{b.students} students</span>
              </div>
              {b.description && <p className="mt-1.5 text-sm text-muted">{b.description}</p>}
              <div className="mt-auto flex gap-2 pt-4">
                <Link href={`/admin/users?batch=${b.id}`} className="btn btn-secondary min-h-9 flex-1 py-1.5 text-xs">View students</Link>
                <button type="button" className="btn btn-ghost min-h-9 px-3 py-1.5 text-xs" onClick={() => open(b)}>Edit</button>
                <button
                  type="button"
                  className="btn btn-ghost min-h-9 px-3 py-1.5 text-xs text-danger"
                  onClick={() => { setError(null); setDeleting(b); }}
                  aria-label={`Delete ${b.name}`}
                >
                  <Icon name="trash" className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New batch" : "Edit batch"}>
        <form onSubmit={save} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <label htmlFor="b-name" className="label">Batch name</label>
            <input id="b-name" name="name" className="input" placeholder="e.g. Engineering 2026" defaultValue={editing && editing !== "new" ? editing.name : ""} required />
          </div>
          <div>
            <label htmlFor="b-desc" className="label">Description <span className="text-subtle">(optional)</span></label>
            <textarea id="b-desc" name="description" rows={3} className="input" defaultValue={editing && editing !== "new" ? (editing.description ?? "") : ""} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete batch">
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <p className="text-sm text-muted">
            Delete <span className="font-semibold text-fg">{deleting?.name}</span>? Its {deleting?.students ?? 0} student(s) will stay, but will no longer belong to a batch.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete batch"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
