import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Study Notes" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  await requireRole("STUDENT");
  const { subject } = await searchParams;
  const notes = await db.studyNote.findMany({
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { id: true, name: true, unit: { select: { name: true } } } } },
  });
  const subjects = [...new Map(notes.map((n) => [n.subject.id, `${n.subject.unit.name} › ${n.subject.name}`])).entries()];
  const shown = subject ? notes.filter((n) => n.subjectId === subject) : notes;
  return (
    <>
      <PageHeader title="Study Notes" description="Notes and handouts from your teachers." />
      {subjects.length > 1 && (
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by subject">
          <Link href="/student/notes" className={`btn min-h-9 shrink-0 px-3 py-1.5 text-xs ${!subject ? "btn-primary" : "btn-secondary"}`}>All</Link>
          {subjects.map(([id, name]) => (
            <Link key={id} href={`/student/notes?subject=${id}`} className={`btn min-h-9 shrink-0 px-3 py-1.5 text-xs ${subject === id ? "btn-primary" : "btn-secondary"}`}>{name}</Link>
          ))}
        </nav>
      )}
      {shown.length === 0 ? (
        <EmptyState icon="book" title="No notes yet">Your teachers haven&apos;t uploaded any notes yet.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((n) => (
            <li key={n.id}>
              <Link href={`/student/notes/${n.id}`} className="card flex h-full items-start gap-3 p-4 transition-colors hover:border-line-strong">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon name={n.kind === "PDF" ? "file" : "book"} /></span>
                <div className="min-w-0">
                  <h2 className="font-semibold" lang="bn">{n.title}</h2>
                  <div className="text-xs text-subtle">{n.subject.name} · {n.kind === "PDF" ? "PDF" : "Text"} · {formatDate(n.createdAt)}</div>
                  {n.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{n.description}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
