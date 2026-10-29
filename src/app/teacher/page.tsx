import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Icon } from "@/components/icons";
import { PageHeader, StatCard } from "@/components/ui";

export const metadata: Metadata = { title: "Teacher dashboard" };

export default async function TeacherDashboard() {
  const user = await requireRole("TEACHER");
  const [questions, exams, submissions, notes] = await Promise.all([
    db.question.count({ where: { createdById: user.id, deletedAt: null } }),
    db.exam.count({ where: { createdById: user.id } }),
    db.attempt.count({ where: { status: "SUBMITTED", exam: { createdById: user.id } } }),
    db.studyNote.count({ where: { createdById: user.id } }),
  ]);
  const links = [
    ["/teacher/questions/new", "book", "Add a question", "Bangla, English or both, with formulas"],
    ["/teacher/questions/import", "upload", "Import questions", "From an Excel or CSV template"],
    ["/teacher/exams/new", "clipboard", "Create an exam", "Mock test, quiz or practice set"],
    ["/teacher/notes", "file", "Share a study note", "PDF or text for a subject"],
  ] as const;
  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="Your questions, exams and results at a glance." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="My questions" value={questions} icon="book" />
        <StatCard label="My exams" value={exams} icon="clipboard" />
        <StatCard label="Submissions" value={submissions} icon="chart" hint="On your exams" />
        <StatCard label="My notes" value={notes} icon="file" />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {links.map(([href, icon, title, body]) => (
          <Link key={href} href={href} className="card flex items-center gap-4 p-5 transition-colors hover:border-line-strong">
            <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon name={icon} /></span>
            <div><div className="font-semibold">{title}</div><div className="text-sm text-muted">{body}</div></div>
          </Link>
        ))}
      </div>
    </>
  );
}
