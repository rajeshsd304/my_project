import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const ALERT_STYLE = {
  error: "border-danger/30 bg-danger-soft text-danger",
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  info: "border-accent/30 bg-accent-soft text-accent-text",
} as const;

export function Alert({ tone = "info", children }: { tone?: keyof typeof ALERT_STYLE; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${ALERT_STYLE[tone]}`}>
      {children}
    </div>
  );
}

const ROLE_STYLE: Record<Role, string> = {
  ADMIN: "border-warning/30 bg-warning-soft text-warning",
  TEACHER: "border-success/30 bg-success-soft text-success",
  STUDENT: "border-accent/30 bg-accent-soft text-accent-text",
};

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge ${ROLE_STYLE[role]}`}>{ROLE_LABEL[role]}</span>;
}

export function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon: IconName; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-text">
          <Icon name={icon} className="size-[18px]" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-3 text-subtle">
        <Icon name={icon} className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
