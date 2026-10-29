import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { ROLE_HOME } from "@/lib/roles";
import { Logo } from "./logo";
import { MobileNav, NavLinks, UserMenu } from "./nav-client";

/** Dashboard chrome shared by all roles: sidebar on desktop, top bar + drawer on phones. */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const items = NAV[user.role];
  const home = ROLE_HOME[user.role];
  return (
    <div className="min-h-dvh bg-black">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo href={home} />
        </div>
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">
          <NavLinks items={items} home={home} />
        </nav>
        <div className="border-t border-line p-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-black/85 px-4 backdrop-blur lg:hidden">
        <Logo href={home} />
        <MobileNav items={items} home={home} user={user} />
      </header>

      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
