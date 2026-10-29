import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ROLE_HOME } from "@/lib/roles";
import { RegisterForm } from "@/components/forms/register-form";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);
  const settings = await getSettings();

  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Create your account</h1>
      {settings.allowSelfRegistration ? (
        <>
          <p className="mt-1 text-sm text-muted">Start practising right away.</p>
          <div className="mt-6">
            <RegisterForm />
          </div>
        </>
      ) : (
        <div className="mt-4">
          <Alert tone="info">Registration is currently closed. Please contact the coaching center for an account.</Alert>
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-text hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
