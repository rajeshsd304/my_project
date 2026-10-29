import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader, RoleBadge } from "@/components/ui";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireRole("ADMIN", "TEACHER", "STUDENT");
  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted">Name</dt><dd className="text-right">{user.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Phone</dt><dd className="text-right">{user.phone ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Email</dt><dd className="text-right break-all">{user.email ?? "—"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted">Role</dt><dd><RoleBadge role={user.role} /></dd></div>
          </dl>
          <p className="mt-5 text-xs text-subtle">To change your name, phone or email, contact the coaching center.</p>
        </section>
        <section className="card p-6">
          <h2 className="font-semibold">Change password</h2>
          <div className="mt-4"><ChangePasswordForm /></div>
        </section>
      </div>
    </>
  );
}
