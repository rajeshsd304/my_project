import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { getTaxonomy } from "@/lib/taxonomy";
import { PageHeader } from "@/components/ui";
import { AnnouncementsManager } from "./announcements-manager";
import { NotesManager } from "./notes-manager";

export async function AnnouncementsAdminPage() {
  const [items, batches] = await Promise.all([
    db.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { batch: { select: { name: true } } } }),
    db.batch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Announcements" description="Shown on the student dashboard. Bangla, English or mixed." />
      <AnnouncementsManager items={items.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))} batches={batches} />
    </>
  );
}

export async function NotesStaffPage({ user }: { user: CurrentUser }) {
  const [notes, taxonomy] = await Promise.all([
    db.studyNote.findMany({
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { name: true, unitId: true, unit: { select: { name: true } } } }, file: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
    getTaxonomy(),
  ]);
  return (
    <>
      <PageHeader title="Study Notes" description="PDF or text notes per subject. Students can read and download them." />
      <NotesManager
        taxonomy={taxonomy}
        notes={notes.map((n) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          kind: n.kind as "TEXT" | "PDF",
          body: n.body,
          fileId: n.fileId,
          fileName: n.file?.name ?? null,
          unitId: n.subject.unitId,
          subjectId: n.subjectId,
          place: `${n.subject.unit.name} › ${n.subject.name}`,
          author: n.createdBy?.name ?? "—",
          editable: user.role === "ADMIN" || n.createdById === user.id,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
