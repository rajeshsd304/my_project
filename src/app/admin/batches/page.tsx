import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BatchesManager } from "./batches-manager";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage() {
  await requireRole("ADMIN");
  const batches = await db.batch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true, _count: { select: { students: true } } },
  });
  return (
    <>
      <PageHeader title="Batches" description="Group students (e.g. Engineering 2026, Medical Evening) to target exams and rankings." />
      <BatchesManager batches={batches.map((b) => ({ id: b.id, name: b.name, description: b.description, students: b._count.students }))} />
    </>
  );
}
