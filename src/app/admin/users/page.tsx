import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isRole, ROLES, ROLE_LABEL } from "@/lib/roles";
import { publicUserSelect } from "@/lib/users";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 50;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; batch?: string; page?: string; new?: string }>;
}) {
  const me = await requireRole("ADMIN");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const role = isRole(sp.role) ? sp.role : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(sp.batch ? { batchId: sp.batch === "none" ? null : sp.batch } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] } : {}),
  };
  const [users, total, batches] = await Promise.all([
    db.user.findMany({ where, select: publicUserSelect, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.user.count({ where }),
    db.batch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const params = new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(sp.batch && { batch: sp.batch }), page: String(p) });
    return `/admin/users?${params}`;
  };

  return (
    <>
      <PageHeader
        title="Users"
        description={`${total} ${total === 1 ? "account" : "accounts"}`}
        actions={
          <Link href="/admin/users/import" className="btn btn-secondary">
            <Icon name="upload" className="size-4" /> Import CSV
          </Link>
        }
      />

      <form className="card mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <input name="q" defaultValue={q} placeholder="Search name, phone or email" className="input" aria-label="Search" />
        <select name="role" defaultValue={role ?? ""} className="input sm:w-36" aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select name="batch" defaultValue={sp.batch ?? ""} className="input sm:w-44" aria-label="Batch">
          <option value="">All batches</option>
          <option value="none">No batch</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="btn btn-secondary"><Icon name="search" className="size-4" /> Filter</button>
      </form>

      <UsersManager
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        batches={batches}
        currentUserId={me.id}
        openCreate={sp.new === "1"}
      />

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn-secondary">Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="btn btn-secondary">Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
