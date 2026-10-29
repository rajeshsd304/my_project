import Link from "next/link";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { UNDO_WINDOW_MS } from "@/lib/question-import";
import { getTaxonomy } from "@/lib/taxonomy";
import { Alert, PageHeader } from "@/components/ui";
import { ImportHistory } from "./import-history";
import { ImportWizard } from "./import-wizard";
import { TaxonomyManager } from "./taxonomy-manager";

export async function ImportPage({ base }: { base: string }) {
  const taxonomy = await getTaxonomy();
  return (
    <>
      <PageHeader
        title="Import questions"
        description="Upload an Excel or CSV file, check every row in the preview, then import."
        actions={<Link href={`${base}/questions/imports`} className="btn btn-ghost">Import history</Link>}
      />
      {taxonomy.some((u) => u.subjects.length) ? <ImportWizard taxonomy={taxonomy} base={base} /> : <Alert tone="warning">Create a unit and subject first.</Alert>}
    </>
  );
}

export async function ImportsPage({ user, base }: { user: CurrentUser; base: string }) {
  const imports = await db.questionImport.findMany({
    where: user.role === "ADMIN" ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { createdBy: { select: { name: true } } },
  });
  const now = Date.now();
  return (
    <>
      <PageHeader
        title="Import history"
        description="Every import, with undo available for 24 hours."
        actions={<Link href={`${base}/questions/import`} className="btn btn-primary">New import</Link>}
      />
      <ImportHistory
        imports={imports.map((i) => ({
          id: i.id,
          fileName: i.fileName,
          template: i.template,
          by: i.createdBy?.name ?? "—",
          createdAt: i.createdAt.toISOString(),
          totalRows: i.totalRows,
          importedCount: i.importedCount,
          skippedCount: i.skippedCount,
          warningCount: i.warningCount,
          undoneAt: i.undoneAt?.toISOString() ?? null,
          canUndo: !i.undoneAt && now - i.createdAt.getTime() < UNDO_WINDOW_MS,
        }))}
      />
    </>
  );
}

export async function TaxonomyPage() {
  const [taxonomy, counts] = await Promise.all([
    getTaxonomy(),
    db.question.groupBy({ by: ["subjectId"], where: { deletedAt: null }, _count: { _all: true } }),
  ]);
  return (
    <>
      <PageHeader title="Units, subjects & topics" description="How the question bank is organised: Unit → Subject → Topic." actions={<Link href="/admin/questions" className="btn btn-ghost">Back to bank</Link>} />
      <TaxonomyManager taxonomy={taxonomy} counts={Object.fromEntries(counts.map((c) => [c.subjectId, c._count._all]))} />
    </>
  );
}
