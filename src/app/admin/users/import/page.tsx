import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportPage() {
  await requireRole("ADMIN");
  const batches = await db.batch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader
        title="Import students"
        description="Add many students at once from a CSV file."
        actions={<Link href="/admin/users" className="btn btn-ghost">Back to users</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ImportForm batches={batches} />
        <aside className="card h-fit p-5 text-sm">
          <h2 className="font-semibold">CSV format</h2>
          <p className="mt-2 text-muted">
            Columns: <code className="text-accent-text">name, phone, batch</code>. Optional: <code className="text-accent-text">email, password</code>.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-black p-3 text-xs leading-relaxed text-muted">
{`name,phone,batch
Rahim Uddin,01711000001,Engineering 2026
সাদিয়া ইসলাম,01811000002,Medical 2026
Tanvir Ahmed,+8801911000003,`}
          </pre>
          <ul className="mt-3 list-disc space-y-1 pl-4 text-muted">
            <li>Phone numbers must be Bangladeshi mobile numbers.</li>
            <li>Batches that don&apos;t exist yet are created automatically (you can turn this off).</li>
            <li>Rows without a password get a generated one — download the credentials after import.</li>
            <li>Rows whose phone is already registered are skipped.</li>
            <li>Save the file as <strong>CSV UTF-8</strong> so Bangla names import correctly.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
