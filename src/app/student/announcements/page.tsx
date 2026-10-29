import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui";
import { AnnouncementCard } from "@/features/content/announcement-card";

export const metadata: Metadata = { title: "Announcements" };

export default async function Page() {
  const user = await requireRole("STUDENT");
  const items = await db.announcement.findMany({
    where: { OR: [{ batchId: null }, ...(user.batchId ? [{ batchId: user.batchId }] : [])] },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { batch: { select: { name: true } } },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Announcements" />
      {items.length ? <div className="space-y-3">{items.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div> : <EmptyState icon="megaphone" title="No announcements yet" />}
    </>
  );
}
