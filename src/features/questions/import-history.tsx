"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Alert, EmptyState } from "@/components/ui";

export type ImportRecord = {
  id: string;
  fileName: string;
  template: string;
  by: string;
  createdAt: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  warningCount: number;
  undoneAt: string | null;
  canUndo: boolean;
};

export function ImportHistory({ imports }: { imports: ImportRecord[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function undo(r: ImportRecord) {
    if (!window.confirm(`Undo the import of "${r.fileName}"? Its ${r.importedCount} question(s) will be removed from the bank.`)) return;
    setBusy(r.id);
    setNotice(null);
    try {
      const res = await api<{ deleted: number; archived: number }>(`/api/questions/imports/${r.id}/undo`, { body: {} });
      setNotice({
        tone: "success",
        text: `Import undone: ${res.deleted + res.archived} question(s) removed${res.archived ? ` (${res.archived} kept only for exams that already use them)` : ""}.`,
      });
      router.refresh();
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!imports.length) return <EmptyState icon="upload" title="No imports yet">Imported files will be listed here, with undo available for 24 hours.</EmptyState>;

  return (
    <>
      {notice && <div className="mb-4"><Alert tone={notice.tone}>{notice.text}</Alert></div>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>File</th><th>By</th><th>When</th><th className="text-right">Rows</th><th className="text-right">Imported</th><th className="text-right">Skipped</th><th className="text-right">Warnings</th><th /></tr>
          </thead>
          <tbody>
            {imports.map((r) => (
              <tr key={r.id}>
                <td className="max-w-56 truncate font-medium" title={r.fileName}>
                  {r.fileName}
                  <div className="text-xs font-normal text-subtle">{r.template === "BOTH" ? "Both-language" : "Simple"} template</div>
                </td>
                <td className="text-muted">{r.by}</td>
                <td className="whitespace-nowrap text-muted">{new Date(r.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="text-right tabular-nums">{r.totalRows}</td>
                <td className="text-right text-success tabular-nums">{r.importedCount}</td>
                <td className="text-right text-muted tabular-nums">{r.skippedCount}</td>
                <td className="text-right text-warning tabular-nums">{r.warningCount}</td>
                <td className="text-right">
                  {r.undoneAt ? (
                    <span className="badge border-line-strong text-subtle">Undone</span>
                  ) : r.canUndo ? (
                    <button type="button" className="btn btn-danger min-h-8 px-3 py-1 text-xs" disabled={busy === r.id} onClick={() => undo(r)}>
                      {busy === r.id ? "Undoing…" : "Undo import"}
                    </button>
                  ) : (
                    <span className="text-xs text-subtle">Undo expired</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
