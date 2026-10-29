import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { type Role } from "@/lib/roles";
import { Icon } from "@/components/icons";
import { PageHeader, RoleBadge, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboard() {
  const user = await requireRole("ADMIN");
  const [students, teachers, batches, unassigned, settings, recent, questions, exams, submissions] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "TEACHER" } }),
    db.batch.count(),
    db.user.count({ where: { role: "STUDENT", batchId: null } }),
    getSettings(),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, phone: true, email: true, role: true, createdAt: true },
    }),
    db.question.count({ where: { deletedAt: null } }),
    db.exam.count({ where: { status: "PUBLISHED" } }),
    db.attempt.count({ where: { status: "SUBMITTED" } }),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Overview of your coaching center."
        actions={
          <>
            <Link href="/admin/users/import" className="btn btn-secondary"><Icon name="upload" className="size-4" /> Import CSV</Link>
            <Link href="/admin/users?new=1" className="btn btn-primary"><Icon name="plus" className="size-4" /> Add user</Link>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Students" value={students} icon="users" hint={`${unassigned} without a batch`} />
        <StatCard label="Teachers" value={teachers} icon="pen" />
        <StatCard label="Batches" value={batches} icon="layers" />
        <StatCard label="Questions" value={questions} icon="book" />
        <StatCard label="Published exams" value={exams} icon="clipboard" />
        <StatCard label="Submissions" value={submissions} icon="chart" />
        <StatCard
          label="Self-registration"
          value={<span className={settings.allowSelfRegistration ? "text-success" : "text-muted"}>{settings.allowSelfRegistration ? "On" : "Off"}</span>}
          icon="settings"
          hint="Change in Settings"
        />
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">Recently added</h2>
          <Link href="/admin/users" className="text-sm font-medium text-accent-text hover:underline">View all</Link>
        </div>
        <ul className="divide-y divide-line">
          {recent.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{u.name}</div>
                <div className="truncate text-xs text-subtle">{u.phone ?? u.email}</div>
              </div>
              <RoleBadge role={u.role as Role} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
