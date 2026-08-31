"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h3.5v-6h5v6H18a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V4m0 0 4 4m-4-4-4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function TransactionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.3 3.7 7 7a1 1 0 0 1 0 1.4l-6.2 6.2a1 1 0 0 1-1.4 0l-7-7A1 1 0 0 1 3.4 10l.5-5.8A1 1 0 0 1 4.8 3.3l5.8-.5a1 1 0 0 1 .7.9Z" />
      <circle cx="8.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BudgetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4M3 7l3-3.5h9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a2 2 0 0 1 0-4Z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", enabled: true, icon: DashboardIcon },
  { label: "Importar extrato", href: "/dashboard/importar", enabled: true, icon: ImportIcon },
  { label: "Transações", href: "/dashboard/transacoes", enabled: true, icon: TransactionsIcon },
  { label: "Categorias", href: "/dashboard/categorias", enabled: true, icon: CategoriesIcon },
  { label: "Orçamento", href: "#", enabled: false, icon: BudgetIcon },
] as const;

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const enabledItems = NAV_ITEMS.filter((item) => item.enabled);

  return (
    <>
      <div className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="shrink-0">
            <LogoutButton />
          </div>
        </div>
      </div>

      <aside className="hidden h-full w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar px-4 py-5 md:flex">
        <div>
          <div className="px-1 pb-6">
            <Logo />
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.enabled && pathname === item.href;
              const Icon = item.icon;

              if (!item.enabled) {
                return (
                  <span
                    key={item.label}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-sidebar-foreground-muted/60"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon />
                      {item.label}
                    </span>
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
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-active text-sidebar-foreground"
                      : "text-sidebar-foreground-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon />
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

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-sidebar-border bg-sidebar px-1 py-1.5 md:hidden">
        {enabledItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-sidebar-foreground"
                  : "text-sidebar-foreground-muted"
              }`}
            >
              <Icon />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
