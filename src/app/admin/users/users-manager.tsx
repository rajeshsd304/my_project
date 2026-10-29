"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import { CredentialNotice } from "@/components/credential-notice";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Alert, EmptyState, RoleBadge } from "@/components/ui";

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  batchId: string | null;
  createdAt: string;
  batch: { id: string; name: string } | null;
};
type BatchOption = { id: string; name: string };

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: UserRow }
  | { kind: "reset"; user: UserRow }
  | { kind: "delete"; user: UserRow }
  | { kind: "credentials"; login: string; password: string; title: string };

export function UsersManager({
  users,
  batches,
  currentUserId,
  openCreate,
}: {
  users: UserRow[];
  batches: BatchOption[];
  currentUserId: string;
  openCreate: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(openCreate ? { kind: "create" } : null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBatch, setBulkBatch] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const close = () => setDialog(null);
  const done = (text?: string) => {
    setDialog(null);
    if (text) setNotice({ tone: "success", text });
    router.refresh();
  };

  const students = users.filter((u) => u.role === "STUDENT");
  const allSelected = students.length > 0 && students.every((u) => selected.has(u.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function toggleActive(user: UserRow) {
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: { active: !user.active } });
      done(`${user.name} has been ${user.active ? "deactivated" : "activated"}.`);
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    }
  }

  async function assignBatch() {
    try {
      const res = await api<{ updated: number }>("/api/admin/batches/assign", {
        body: { batchId: bulkBatch === "none" ? null : bulkBatch, userIds: [...selected] },
      });
      setSelected(new Set());
      setBulkBatch("");
      done(`${res.updated} student(s) updated.`);
    } catch (err) {
      setNotice({ tone: "error", text: (err as Error).message });
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: "create" })}>
          <Icon name="plus" className="size-4" /> Add user
        </button>
        {selected.size > 0 && (
          <div className="card flex flex-1 flex-wrap items-center gap-2 px-3 py-2 sm:flex-none">
            <span className="text-sm text-muted">{selected.size} selected</span>
            <select value={bulkBatch} onChange={(e) => setBulkBatch(e.target.value)} className="input min-h-9 w-auto py-1.5 text-sm" aria-label="Assign to batch">
              <option value="">Move to batch…</option>
              <option value="none">Remove from batch</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button type="button" className="btn btn-secondary min-h-9 py-1.5" disabled={!bulkBatch} onClick={assignBatch}>
              Apply
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {users.length === 0 ? (
        <EmptyState icon="users" title="No users found">Try a different search, or add a user.</EmptyState>
      ) : (
        <>
          {/* Phones: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {users.map((u) => (
              <li key={u.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {u.role === "STUDENT" && (
                    <input type="checkbox" className="mt-1.5 size-4 accent-[var(--accent)]" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={`Select ${u.name}`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{u.name}</span>
                      <RoleBadge role={u.role as Role} />
                    </div>
                    <div className="mt-1 truncate text-sm text-muted">{[u.phone, u.email].filter(Boolean).join(" · ")}</div>
                    <div className="mt-1 text-xs text-subtle">
                      {u.batch?.name ?? (u.role === "STUDENT" ? "No batch" : "")}
                      {!u.active && <span className="ml-2 text-danger">Deactivated</span>}
                    </div>
                  </div>
                </div>
                <RowActions user={u} self={u.id === currentUserId} onDialog={setDialog} onToggle={toggleActive} />
              </li>
            ))}
          </ul>

          {/* Tablets and up: table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(students.map((u) => u.id)))}
                      aria-label="Select all students"
                      disabled={students.length === 0}
                    />
                  </th>
                  <th>Name</th>
                  <th>Login</th>
                  <th>Role</th>
                  <th>Batch</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.role === "STUDENT" && (
                        <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={`Select ${u.name}`} />
                      )}
                    </td>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-muted">
                      {u.phone && <div>{u.phone}</div>}
                      {u.email && <div className="text-xs">{u.email}</div>}
                    </td>
                    <td><RoleBadge role={u.role as Role} /></td>
                    <td className="text-muted">{u.batch?.name ?? "—"}</td>
                    <td>
                      {u.active ? (
                        <span className="badge border-success/30 bg-success-soft text-success">Active</span>
                      ) : (
                        <span className="badge border-danger/30 bg-danger-soft text-danger">Deactivated</span>
                      )}
                    </td>
                    <td><RowActions user={u} self={u.id === currentUserId} onDialog={setDialog} onToggle={toggleActive} compact /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={dialog?.kind === "create"} onClose={close} title="Add user">
        <UserForm
          batches={batches}
          onCancel={close}
          onSaved={(user, password) => {
            router.refresh();
            if (password) {
              setDialog({ kind: "credentials", login: user.phone ?? user.email ?? "", password, title: `${user.name} created` });
            } else done(`${user.name} has been created.`);
          }}
        />
      </Modal>

      <Modal open={dialog?.kind === "edit"} onClose={close} title="Edit user">
        {dialog?.kind === "edit" && (
          <UserForm user={dialog.user} batches={batches} onCancel={close} onSaved={(u) => done(`${u.name} has been updated.`)} />
        )}
      </Modal>

      <Modal open={dialog?.kind === "reset"} onClose={close} title="Reset password">
        {dialog?.kind === "reset" && (
          <ResetPasswordForm
            user={dialog.user}
            onCancel={close}
            onReset={(password) =>
              setDialog({ kind: "credentials", login: dialog.user.phone ?? dialog.user.email ?? "", password, title: "Password reset" })
            }
          />
        )}
      </Modal>

      <Modal open={dialog?.kind === "delete"} onClose={close} title="Delete user">
        {dialog?.kind === "delete" && <DeleteUser user={dialog.user} onCancel={close} onDeleted={() => done(`${dialog.user.name} has been deleted.`)} />}
      </Modal>

      <Modal open={dialog?.kind === "credentials"} onClose={close} title={dialog?.kind === "credentials" ? dialog.title : ""}>
        {dialog?.kind === "credentials" && (
          <>
            <CredentialNotice login={dialog.login} password={dialog.password} />
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn btn-primary" onClick={close}>Done</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function RowActions({
  user,
  self,
  compact,
  onDialog,
  onToggle,
}: {
  user: UserRow;
  self: boolean;
  compact?: boolean;
  onDialog: (d: Dialog) => void;
  onToggle: (u: UserRow) => void;
}) {
  const cls = compact ? "btn btn-ghost min-h-9 px-2.5 py-1.5 text-xs" : "btn btn-secondary min-h-9 flex-1 py-1.5 text-xs";
  return (
    <div className={compact ? "flex justify-end gap-1" : "mt-3 flex gap-2 border-t border-line pt-3"}>
      <button type="button" className={cls} onClick={() => onDialog({ kind: "edit", user })}>Edit</button>
      <button type="button" className={cls} onClick={() => onDialog({ kind: "reset", user })}>
        <Icon name="key" className="size-3.5" /> Password
      </button>
      {!self && (
        <>
          <button type="button" className={cls} onClick={() => onToggle(user)}>{user.active ? "Deactivate" : "Activate"}</button>
          <button type="button" className={`${cls} text-danger`} onClick={() => onDialog({ kind: "delete", user })} aria-label={`Delete ${user.name}`}>
            <Icon name="trash" className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function UserForm({
  user,
  batches,
  onCancel,
  onSaved,
}: {
  user?: UserRow;
  batches: BatchOption[];
  onCancel: () => void;
  onSaved: (user: UserRow, generatedPassword?: string) => void;
}) {
  const [role, setRole] = useState<Role>((user?.role as Role) ?? "STUDENT");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
      role,
      batchId: role === "STUDENT" ? form.get("batchId") : null,
      ...(user ? {} : { password: form.get("password") }),
    };
    setPending(true);
    setError(null);
    try {
      const res = user
        ? await api<{ user: UserRow; password?: string }>(`/api/admin/users/${user.id}`, { method: "PATCH", body })
        : await api<{ user: UserRow; password?: string }>("/api/admin/users", { body });
      onSaved(res.user, res.password);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <label htmlFor="u-name" className="label">Full name</label>
        <input id="u-name" name="name" className="input" defaultValue={user?.name} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="u-phone" className="label">Phone</label>
          <input id="u-phone" name="phone" type="tel" inputMode="tel" className="input" placeholder="01XXXXXXXXX" defaultValue={user?.phone ?? ""} />
        </div>
        <div>
          <label htmlFor="u-email" className="label">Email</label>
          <input id="u-email" name="email" type="email" className="input" defaultValue={user?.email ?? ""} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-subtle">At least one of phone or email is required — it is used to log in.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="u-role" className="label">Role</label>
          <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        {role === "STUDENT" && (
          <div>
            <label htmlFor="u-batch" className="label">Batch</label>
            <select id="u-batch" name="batchId" className="input" defaultValue={user?.batchId ?? ""}>
              <option value="">No batch</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>
      {!user && (
        <div>
          <label htmlFor="u-password" className="label">Password <span className="text-subtle">(optional)</span></label>
          <input id="u-password" name="password" type="text" className="input" autoComplete="off" placeholder="Leave blank to generate one" />
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : user ? "Save changes" : "Create user"}</button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ user, onCancel, onReset }: { user: UserRow; onCancel: () => void; onReset: (password: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await api<{ password: string }>(`/api/admin/users/${user.id}/reset-password`, {
        body: { password: form.get("password") },
      });
      onReset(res.password);
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-muted">
        Set a new password for <span className="font-semibold text-fg">{user.name}</span>. They will be logged out of all devices.
      </p>
      <div>
        <label htmlFor="r-password" className="label">New password <span className="text-subtle">(optional)</span></label>
        <input id="r-password" name="password" type="text" className="input" autoComplete="off" placeholder="Leave blank to generate one" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Resetting…" : "Reset password"}</button>
      </div>
    </form>
  );
}

function DeleteUser({ user, onCancel, onDeleted }: { user: UserRow; onCancel: () => void; onDeleted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-sm text-muted">
        Permanently delete <span className="font-semibold text-fg">{user.name}</span>? This cannot be undone. To block access but keep their
        records, deactivate the account instead.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete user"}</button>
      </div>
    </div>
  );
}
