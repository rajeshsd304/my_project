"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { Alert } from "@/components/ui";
import { PasswordInput } from "./password-input";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await api<{ redirect: string }>("/api/auth/login", {
        body: { identifier: form.get("identifier"), password: form.get("password") },
      });
      router.replace(next ?? res.redirect);
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
        <label htmlFor="identifier" className="label">Phone number or email</label>
        <input
          id="identifier"
          name="identifier"
          className="input"
          autoComplete="username"
          inputMode="email"
          placeholder="01XXXXXXXXX or you@example.com"
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
