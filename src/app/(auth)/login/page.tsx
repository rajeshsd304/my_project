import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ROLE_HOME } from "@/lib/roles";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const [{ next }, settings] = await Promise.all([searchParams, getSettings()]);
  // Only allow same-site relative redirects.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in with your phone number or email.</p>
      <div className="mt-6">
        <LoginForm next={safeNext} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        {settings.allowSelfRegistration ? (
          <>
            New here?{" "}
            <Link href="/register" className="font-semibold text-accent-text hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          "Need an account or forgot your password? Contact the coaching center."
        )}
      </p>
    </div>
  );
}
