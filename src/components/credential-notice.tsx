"use client";

import { useState } from "react";

/** Shows a login + generated password once, so the admin can hand it to the student. */
export function CredentialNotice({ login, password }: { login: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const text = `NextCampus login\nPhone/Email: ${login}\nPassword: ${password}`;
  return (
    <div className="rounded-xl border border-success/30 bg-success-soft p-4">
      <p className="text-sm text-success">Share these details with the user. The password will not be shown again.</p>
      <dl className="mt-3 space-y-1.5 font-mono text-sm">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted">Login</dt><dd className="break-all">{login}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted">Password</dt><dd className="break-all select-all">{password}</dd></div>
      </dl>
      <button
        type="button"
        className="btn btn-secondary mt-3 min-h-9 py-1.5"
        onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      >
        {copied ? "Copied" : "Copy details"}
      </button>
    </div>
  );
}
