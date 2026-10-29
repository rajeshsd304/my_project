"use client";

import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { Alert } from "@/components/ui";
import { PasswordInput } from "./password-input";

export function ChangePasswordForm() {
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    if (form.get("newPassword") !== form.get("confirm")) {
      setStatus({ tone: "error", text: "New passwords do not match." });
      return;
    }
    setPending(true);
    setStatus(null);
    try {
      await api("/api/me/password", {
        body: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") },
      });
      formEl.reset();
      setStatus({ tone: "success", text: "Password changed. Other devices have been logged out." });
    } catch (err) {
      setStatus({ tone: "error", text: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {status && <Alert tone={status.tone}>{status.text}</Alert>}
      <div>
        <label htmlFor="currentPassword" className="label">Current password</label>
        <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="newPassword" className="label">New password</label>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
