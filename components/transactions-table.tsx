import type { DashboardTransaction } from "@/lib/dashboard";
import { currencyFormatter } from "@/lib/format";
import { groupByDay, initialsFor } from "@/lib/transaction-display";

function formatDate(occurredOn: string): string {
  const [year, month, day] = occurredOn.split("-");
  return `${day}/${month}/${year}`;
}

export function TransactionsTable({
  transactions,
}: {
  transactions: DashboardTransaction[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-lg bg-surface-hover px-3 py-2 text-sm text-muted">
        Nenhuma transação neste mês.
      </p>
    );
  }

  const groups = groupByDay(transactions);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:hidden">
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
                    className={`shrink-0 text-sm font-semibold ${
                      transaction.direction === "entrada" ? "text-success" : "text-danger"
                    }`}
                  >
                    {transaction.direction === "saida" ? "-" : ""}
                    {currencyFormatter.format(transaction.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-left text-muted">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Descrição</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="border-t border-border">
                <td className="p-2">{formatDate(transaction.occurredOn)}</td>
                <td className="p-2">{transaction.description}</td>
                <td className="p-2">{transaction.categoryName ?? "Sem categoria"}</td>
                <td
                  className={`p-2 ${
                    transaction.direction === "entrada" ? "text-success" : "text-danger"
                  }`}
                >
                  {transaction.direction === "saida" ? "-" : ""}
                  {currencyFormatter.format(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
