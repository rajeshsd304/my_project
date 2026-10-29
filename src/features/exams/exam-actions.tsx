"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Icon } from "@/components/icons";

export function ExamActions({ examId, base, canDelete }: { examId: string; base: string; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    setBusy(true);
    try {
      const res = await api<{ exam: { id: string } }>(`/api/exams/${examId}/duplicate`, { body: {} });
      router.push(`${base}/exams/${res.exam.id}`);
    } catch (err) {
      window.alert((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this exam? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api(`/api/exams/${examId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <button type="button" className="btn btn-ghost min-h-8 px-2.5 py-1 text-xs" disabled={busy} onClick={duplicate}>Duplicate</button>
      {canDelete && (
        <button type="button" className="btn btn-ghost min-h-8 px-2 py-1 text-danger" disabled={busy} onClick={remove} aria-label="Delete exam">
          <Icon name="trash" className="size-3.5" />
        </button>
      )}
    </div>
  );
}
