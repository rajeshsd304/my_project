"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import type { NavItem } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roles";
import { Icon } from "./icons";

export function NavLinks({ items, home, onNavigate }: { items: NavItem[]; home: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = item.href === home ? pathname === home : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-3 hover:text-fg"
              }`}
            >
              <Icon name={item.icon} className="size-[18px]" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function useLogout() {
  const router = useRouter();
  return async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  };
}

export function UserMenu({ user, onNavigate }: { user: CurrentUser; onNavigate?: () => void }) {
  const logout = useLogout();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-semibold">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-subtle">{ROLE_LABEL[user.role]}</div>
        </div>
      </div>
      <Link
        href="/account"
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-3 hover:text-fg"
      >
        <Icon name="user" className="size-[18px]" /> My account
      </Link>
      <button
        type="button"
        onClick={logout}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted hover:bg-surface-3 hover:text-fg"
      >
        <Icon name="logout" className="size-[18px]" /> Log out
      </button>
    </div>
  );
}

export function MobileNav({ items, home, user }: { items: NavItem[]; home: string; user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost -mr-2 px-2.5"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={open ? "close" : "menu"} className="size-6" />
      </button>
      {open && (
        <div className="fixed inset-0 top-14 z-40 flex flex-col overflow-y-auto bg-black px-4 pt-4 pb-8">
          <nav aria-label="Main">
            <NavLinks items={items} home={home} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-6 border-t border-line pt-4">
            <UserMenu user={user} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
