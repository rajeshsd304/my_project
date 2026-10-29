"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Alert } from "@/components/ui";

export function StartExamButton({ examId, resume }: { examId: string; resume: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await api<{ attemptId: string }>(`/api/student/exams/${examId}/start`, { body: {} });
      router.push(`/exam/${res.attemptId}`);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      {resume || confirming ? (
        <button type="button" className="btn btn-primary w-full text-base" disabled={pending} onClick={start}>
          {pending ? "Opening…" : resume ? "Resume exam" : "Yes, start now"}
        </button>
      ) : (
        <button type="button" className="btn btn-primary w-full text-base" onClick={() => setConfirming(true)}>
          Start exam
        </button>
      )}
      {confirming && !resume && <p className="text-center text-xs text-muted">The timer starts as soon as you press the button.</p>}
    </div>
  );
}
