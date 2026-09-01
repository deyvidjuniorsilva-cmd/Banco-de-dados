import Link from "next/link";
import type { DashboardTransaction } from "@/lib/dashboard";
import { currencyFormatter } from "@/lib/format";
import { groupByDay, initialsFor } from "@/lib/transaction-display";

const MAX_ITEMS = 6;

export function RecentTransactions({
  transactions,
  seeAllHref,
}: {
  transactions: DashboardTransaction[];
  seeAllHref: string;
}) {
  const recent = [...transactions]
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
    .slice(0, MAX_ITEMS);

  const groups = groupByDay(recent);

  return (
    <div className="rounded-xl border border-glass-border bg-glass p-5 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Transações recentes</h2>
        <Link href={seeAllHref} className="text-xs font-medium text-brand">
          Ver todas →
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhuma transação neste mês.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{group.label}</p>
              <div className="mt-2 flex flex-col gap-3">
                {group.items.map((transaction) => (
                  <div key={transaction.id} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[11px] font-semibold text-foreground">
                      {initialsFor(transaction.description)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{transaction.description}</p>
                      <p className="text-xs text-muted">{transaction.categoryName ?? "Sem categoria"}</p>
                    </div>
                    <p
                      className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                        transaction.direction === "entrada" ? "text-success" : "text-danger"
                      }`}
                    >
                      {transaction.direction === "entrada" ? "+" : "-"}
                      {currencyFormatter.format(transaction.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
