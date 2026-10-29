"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { TaxonomyTree } from "@/lib/taxonomy";
import { PhoneticTextarea } from "@/components/forms/phonetic-textarea";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { RichText } from "@/components/rich-text";
import { Alert, EmptyState } from "@/components/ui";

export type NoteItem = {
  id: string;
  title: string;
  description: string | null;
  kind: "TEXT" | "PDF";
  body: string | null;
  fileId: string | null;
  fileName: string | null;
  unitId: string;
  subjectId: string;
  place: string;
  author: string;
  editable: boolean;
  createdAt: string;
};

type Form = { title: string; description: string; unitId: string; subjectId: string; kind: "TEXT" | "PDF"; body: string; fileId: string | null; fileName: string | null };

export function NotesManager({ notes, taxonomy }: { notes: NoteItem[]; taxonomy: TaxonomyTree }) {
  const router = useRouter();
  const blank: Form = { title: "", description: "", unitId: taxonomy[0]?.id ?? "", subjectId: "", kind: "TEXT", body: "", fileId: null, fileName: null };
  const [editing, setEditing] = useState<NoteItem | "new" | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [phonetic, setPhonetic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const unit = taxonomy.find((u) => u.id === form.unitId);

  function open(n: NoteItem | "new") {
    setError(null);
    setForm(n === "new" ? blank : { title: n.title, description: n.description ?? "", unitId: n.unitId, subjectId: n.subjectId, kind: n.kind, body: n.body ?? "", fileId: n.fileId, fileName: n.fileName });
    setEditing(n);
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("kind", "pdf");
      const res = await fetch("/api/uploads", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      setForm((f) => ({ ...f, fileId: json.file.id, fileName: json.file.name, title: f.title || file.name.replace(/\.pdf$/i, "") }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const body = { title: form.title, description: form.description || null, subjectId: form.subjectId, kind: form.kind, body: form.kind === "TEXT" ? form.body : null, fileId: form.kind === "PDF" ? form.fileId : null };
      if (editing === "new") await api("/api/notes", { body });
      else if (editing) await api(`/api/notes/${editing.id}`, { method: "PATCH", body });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function remove(n: NoteItem) {
    if (!window.confirm(`Delete "${n.title}"?`)) return;
    await api(`/api/notes/${n.id}`, { method: "DELETE" }).catch((err) => window.alert((err as Error).message));
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn btn-primary mb-4" onClick={() => open("new")}><Icon name="plus" className="size-4" /> Add note</button>
      {notes.length === 0 ? (
        <EmptyState icon="file" title="No notes yet">Upload a PDF or write a text note for a subject. Students can read and download them.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <li key={n.id} className="card flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon name={n.kind === "PDF" ? "file" : "book"} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold" lang="bn">{n.title}</h3>
                  <div className="text-xs text-subtle">{n.place} · {n.kind === "PDF" ? "PDF" : "Text"} · {n.author} · {formatDate(n.createdAt)}</div>
                  {n.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex gap-1 border-t border-line pt-3">
                {n.kind === "PDF" && n.fileId && <a href={`/api/files/${n.fileId}`} target="_blank" rel="noreferrer" className="btn btn-ghost min-h-8 px-2.5 py-1 text-xs">Open PDF</a>}
                {n.editable && (
                  <>
                    <button type="button" className="btn btn-ghost min-h-8 px-2.5 py-1 text-xs" onClick={() => open(n)}>Edit</button>
                    <button type="button" className="btn btn-ghost ml-auto min-h-8 px-2 py-1 text-danger" onClick={() => remove(n)} aria-label="Delete note"><Icon name="trash" className="size-3.5" /></button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add study note" : "Edit study note"}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="n-unit">Unit</label>
              <select id="n-unit" className="input" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value, subjectId: "" })}>
                {taxonomy.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="n-subject">Subject</label>
              <select id="n-subject" className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Choose…</option>
                {unit?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line-strong bg-surface-2 p-1" role="radiogroup" aria-label="Note type">
            {(["TEXT", "PDF"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={form.kind === k} onClick={() => setForm({ ...form, kind: k })} className={`min-h-9 rounded-lg text-sm font-semibold ${form.kind === k ? "bg-accent text-white" : "text-muted"}`}>
                {k === "TEXT" ? "Text note" : "PDF file"}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="n-title">Title</label>
            <input id="n-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="n-desc">Short description (optional)</label>
            <input id="n-desc" className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {form.kind === "TEXT" ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label mb-0" htmlFor="n-body">Note (use $…$ for formulas)</label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={phonetic} onChange={(e) => setPhonetic(e.target.checked)} className="size-3.5 accent-[var(--accent)]" /> Phonetic Bangla
                </label>
              </div>
              <PhoneticTextarea id="n-body" rows={8} value={form.body} onValue={(v) => setForm({ ...form, body: v })} phonetic={phonetic} />
              {form.body.trim() && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-line bg-surface-2 p-3">
                  <div className="mb-1 text-xs font-semibold text-subtle uppercase">Preview</div>
                  <RichText text={form.body} className="text-sm leading-relaxed" />
                </div>
              )}
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center hover:border-accent">
              <Icon name="upload" className="size-6 text-accent-text" />
              <span className="mt-2 text-sm font-medium">{uploading ? "Uploading…" : form.fileName ?? "Choose a PDF (max 20 MB)"}</span>
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={pending || uploading} onClick={save}>{pending ? "Saving…" : "Save note"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}
