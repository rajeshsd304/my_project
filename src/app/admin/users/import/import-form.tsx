"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Papa from "papaparse";
import { api } from "@/lib/client-api";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui";

type Result = {
  created: { line: number; name: string; phone: string; email: string | null; batch: string | null; password: string | null }[];
  createdBatches: string[];
  errors: { line: number; message: string }[];
};

export function ImportForm({ batches }: { batches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return setError("Choose a CSV file first.");
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await api<Result>("/api/admin/users/import", {
        body: {
          csv: await file.text(),
          defaultBatchId: form.get("defaultBatchId") || null,
          createMissingBatches: form.get("createMissingBatches") === "on",
        },
      });
      setResult(res);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  function downloadCredentials() {
    if (!result) return;
    const csv = Papa.unparse(
      result.created.map((r) => ({ name: r.name, phone: r.phone, email: r.email ?? "", batch: r.batch ?? "", password: r.password ?? "(set in file)" })),
    );
    // BOM so Excel opens Bangla names as UTF-8.
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `nextcampus-credentials-${Date.now()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6">
        {error && <Alert tone="error">{error}</Alert>}
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent">
          <Icon name="upload" className="size-7 text-accent-text" />
          <span className="mt-3 font-medium">{file ? file.name : "Choose a CSV file"}</span>
          <span className="mt-1 text-xs text-subtle">{file ? `${(file.size / 1024).toFixed(1)} KB` : "Up to 2,000 students per file"}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </label>
        <div>
          <label htmlFor="defaultBatchId" className="label">Batch for rows with an empty batch column</label>
          <select id="defaultBatchId" name="defaultBatchId" className="input">
            <option value="">No batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="createMissingBatches" defaultChecked className="size-4 accent-[var(--accent)]" />
          Create batches named in the file that don&apos;t exist yet
        </label>
        <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={pending || !file}>
          {pending ? "Importing…" : "Import students"}
        </button>
      </form>

      {result && (
        <section className="card space-y-4 p-5 sm:p-6" aria-live="polite">
          <h2 className="font-semibold">Import result</h2>
          <Alert tone={result.created.length ? "success" : "warning"}>
            {result.created.length} student(s) created
            {result.createdBatches.length > 0 && `, new batches: ${result.createdBatches.join(", ")}`}.
            {result.errors.length > 0 && ` ${result.errors.length} row(s) skipped.`}
          </Alert>
          {result.created.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={downloadCredentials}>
              <Icon name="download" className="size-4" /> Download login credentials (CSV)
            </button>
          )}
          {result.errors.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="table">
                <thead><tr><th className="w-20">Line</th><th>Problem</th></tr></thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i}><td className="tabular-nums text-muted">{e.line}</td><td>{e.message}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
