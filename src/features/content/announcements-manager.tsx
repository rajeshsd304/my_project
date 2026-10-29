"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";
import { PhoneticTextarea } from "@/components/forms/phonetic-textarea";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { RichText } from "@/components/rich-text";
import { Alert, EmptyState } from "@/components/ui";
import { Switch } from "@/features/exams/exam-settings-form";

type Item = { id: string; title: string; body: string; pinned: boolean; batchId: string | null; batch: { name: string } | null; createdAt: string };
const empty = { title: "", body: "", pinned: false, batchId: "" };

export function AnnouncementsManager({ items, batches }: { items: Item[]; batches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [phonetic, setPhonetic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function open(item: Item | "new") {
    setError(null);
    setForm(item === "new" ? empty : { title: item.title, body: item.body, pinned: item.pinned, batchId: item.batchId ?? "" });
    setEditing(item);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const body = { ...form, batchId: form.batchId || null };
      if (editing === "new") await api("/api/announcements", { body });
      else if (editing) await api(`/api/announcements/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await api(`/api/announcements/${item.id}`, { method: "DELETE" }).catch((err) => window.alert((err as Error).message));
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn btn-primary mb-4" onClick={() => open("new")}><Icon name="plus" className="size-4" /> New announcement</button>
      {items.length === 0 ? (
        <EmptyState icon="megaphone" title="No announcements yet">Announcements appear on every student&apos;s dashboard.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className={`card p-4 ${a.pinned ? "border-accent/40" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {a.pinned && <span className="badge border-accent/40 bg-accent-soft text-accent-text">Pinned</span>}
                    <span className="badge border-line-strong text-muted">{a.batch?.name ?? "Everyone"}</span>
                    <span className="text-subtle">{formatDateTime(a.createdAt)}</span>
                  </div>
                  <h3 className="mt-1.5 font-semibold" lang="bn">{a.title}</h3>
                </div>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost min-h-8 px-2.5 py-1 text-xs" onClick={() => open(a)}>Edit</button>
                  <button type="button" className="btn btn-ghost min-h-8 px-2 py-1 text-danger" onClick={() => remove(a)} aria-label="Delete"><Icon name="trash" className="size-3.5" /></button>
                </div>
              </div>
              <RichText text={a.body} className="mt-2 line-clamp-4 text-sm text-fg/85" />
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New announcement" : "Edit announcement"}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <label className="label" htmlFor="a-title">Title</label>
            <input id="a-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Model Test 03 on Friday at 10 AM" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label mb-0" htmlFor="a-body">Message (Bangla, English or both)</label>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={phonetic} onChange={(e) => setPhonetic(e.target.checked)} className="size-3.5 accent-[var(--accent)]" /> Phonetic Bangla
              </label>
            </div>
            <PhoneticTextarea id="a-body" rows={5} value={form.body} onValue={(v) => setForm({ ...form, body: v })} phonetic={phonetic} />
          </div>
          {form.body.trim() && (
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="mb-1 text-xs font-semibold text-subtle uppercase">Preview</div>
              <RichText text={form.body} className="text-sm" />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="a-batch">Show to</label>
              <select id="a-batch" className="input" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                <option value="">Everyone</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex items-end justify-between gap-3 pb-2">
              <span className="text-sm font-medium">Pin to top</span>
              <Switch checked={form.pinned} onChange={(c) => setForm({ ...form, pinned: c })} label="Pin to top" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : editing === "new" ? "Post announcement" : "Save"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
