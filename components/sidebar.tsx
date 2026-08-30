"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Importar extrato", href: "/dashboard/importar", enabled: true },
  { label: "Transações", href: "#", enabled: false },
  { label: "Categorias", href: "#", enabled: false },
  { label: "Orçamento", href: "#", enabled: false },
] as const;

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar px-4 py-5">
      <div>
        <div className="px-1 pb-6">
          <Logo />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.enabled && pathname === item.href;

            if (!item.enabled) {
              return (
                <span
                  key={item.label}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-sidebar-foreground-muted/60"
                >
                  {item.label}
                  <span className="rounded-full bg-sidebar-active px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground-muted">
                    Em breve
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-active text-sidebar-foreground"
                    : "text-sidebar-foreground-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-3 border-t border-sidebar-border pt-4">
        <div className="flex items-center justify-between px-1">
          <span className="truncate text-xs text-sidebar-foreground-muted">
            {userEmail}
          </span>
          <ThemeToggle />
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
