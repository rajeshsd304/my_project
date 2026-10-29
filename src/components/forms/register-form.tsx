"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { Alert } from "@/components/ui";
import { PasswordInput } from "./password-input";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await api<{ redirect: string }>("/api/auth/register", {
        body: {
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      // The account is active immediately — straight to the dashboard.
      router.replace(res.redirect);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" className="input" autoComplete="name" required />
      </div>
      <div>
        <label htmlFor="phone" className="label">Phone number</label>
        <input id="phone" name="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" required />
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email <span className="text-subtle">(optional)</span>
        </label>
        <input id="email" name="email" className="input" type="email" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
        <p className="mt-1 text-xs text-subtle">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm password</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
