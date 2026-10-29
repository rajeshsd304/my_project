import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { RichText } from "@/components/rich-text";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Study note" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("STUDENT");
  const note = await db.studyNote.findUnique({ where: { id: (await params).id }, include: { subject: { select: { name: true } }, file: { select: { size: true } } } });
  if (!note) notFound();
  return (
    <>
      <PageHeader
        title={note.title}
        description={`${note.subject.name} · ${formatDate(note.createdAt)}`}
        actions={
          <>
            {note.fileId && <a href={`/api/files/${note.fileId}?download`} className="btn btn-primary"><Icon name="download" className="size-4" /> Download PDF{note.file ? ` (${(note.file.size / 1024 / 1024).toFixed(1)} MB)` : ""}</a>}
            <Link href="/student/notes" className="btn btn-ghost">All notes</Link>
          </>
        }
      />
      {note.description && <p className="mb-4 text-muted">{note.description}</p>}
      {note.kind === "TEXT" ? (
        <article className="card p-5 sm:p-8">
          <RichText text={note.body} className="text-[17px] leading-relaxed" />
        </article>
      ) : note.fileId ? (
        <div className="card overflow-hidden">
          {/* Inline viewer on larger screens; phones get the download/open button (in-page PDF viewers are unreliable there). */}
          <object data={`/api/files/${note.fileId}`} type="application/pdf" className="hidden h-[80dvh] w-full bg-white md:block" aria-label={note.title} />
          <div className="p-6 text-center md:hidden">
            <a href={`/api/files/${note.fileId}`} target="_blank" rel="noreferrer" className="btn btn-secondary">Open PDF</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
