import type { DashboardTransaction } from "@/lib/dashboard";
import { currencyFormatter } from "@/lib/format";

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

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
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
  );
}
