import { currencyFormatter } from "@/lib/format";

export interface OverBudgetEntry {
  categoryId: string;
  categoryName: string;
  currentSpend: number;
  limitAmount: number;
}

interface BudgetAlertsBannerProps {
  entries: OverBudgetEntry[];
}

export function BudgetAlertsBanner({ entries }: BudgetAlertsBannerProps) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-danger bg-danger-soft px-4 py-3">
      <p className="text-sm font-semibold text-danger">
        {entries.length === 1
          ? "1 categoria estourou o limite este mês"
          : `${entries.length} categorias estouraram o limite este mês`}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-danger">
        {entries.map((entry) => (
          <li key={entry.categoryId}>
            {entry.categoryName}: {currencyFormatter.format(entry.currentSpend)} /{" "}
            {currencyFormatter.format(entry.limitAmount)}
          </li>
        ))}
      </ul>
    </div>
  );
}
