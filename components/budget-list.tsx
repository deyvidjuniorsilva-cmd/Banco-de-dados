"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  upsertBudget,
  deleteBudget,
  isOverBudget,
  isNearBudgetLimit,
  isOverHistoricalAverage,
  type Budget,
} from "@/lib/budgets";
import { errorMessage } from "@/lib/errors";
import { currencyFormatter } from "@/lib/format";

interface BudgetListProps {
  year: number;
  month: number;
  categories: { id: string; name: string }[];
  initialBudgets: Budget[];
  currentSpendByCategory: Record<string, number>;
  historicalAverageByCategory: Record<string, number>;
}

export function BudgetList({
  year,
  month,
  categories,
  initialBudgets,
  currentSpendByCategory,
  historicalAverageByCategory,
}: BudgetListProps) {
  const supabase = createClient();
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function budgetFor(categoryId: string): Budget | undefined {
    return budgets.find((b) => b.categoryId === categoryId);
  }

  function suggestedLimitFor(categoryId: string): number | null {
    if (budgetFor(categoryId)) return null;
    const average = historicalAverageByCategory[categoryId] ?? null;
    return average !== null ? Math.round(average * 100) / 100 : null;
  }

  async function handleSave(categoryId: string) {
    const raw = drafts[categoryId] ?? suggestedLimitFor(categoryId)?.toString();
    const parsed = raw !== undefined ? parseFloat(raw.replace(",", ".")) : NaN;
    if (!Number.isFinite(parsed) || parsed < 0) return;
    try {
      const updated = await upsertBudget(supabase, categoryId, year, month, parsed);
      setBudgets((prev) => [...prev.filter((b) => b.categoryId !== categoryId), updated]);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDelete(budgetId: string, categoryId: string) {
    try {
      await deleteBudget(supabase, budgetId);
      setBudgets((prev) => prev.filter((b) => b.id !== budgetId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      )}
      {categories.length === 0 && (
        <p className="text-sm text-muted">Nenhuma categoria cadastrada ainda.</p>
      )}
      {categories.map((category) => {
        const budget = budgetFor(category.id);
        const currentSpend = currentSpendByCategory[category.id] ?? 0;
        const average = historicalAverageByCategory[category.id] ?? null;
        const limitAmount = budget?.limitAmount ?? null;
        const suggested = limitAmount === null ? suggestedLimitFor(category.id) : null;
        const over = isOverBudget(currentSpend, limitAmount);
        const near = !over && isNearBudgetLimit(currentSpend, limitAmount);
        const overHistorical = isOverHistoricalAverage(currentSpend, average);
        const progress = limitAmount ? Math.min(currentSpend / limitAmount, 1) : 0;

        return (
          <div
            key={category.id}
            className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{category.name}</span>
              <span className="text-muted">{currencyFormatter.format(currentSpend)}</span>
            </div>

            {limitAmount !== null && (
              <div className="relative h-5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={`h-full ${over ? "bg-danger" : near ? "bg-warning" : "bg-brand"}`}
                  style={{ width: `${progress * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-foreground">
                  {currencyFormatter.format(currentSpend)} / {currencyFormatter.format(limitAmount)} (
                  {Math.round(progress * 100)}%)
                </span>
              </div>
            )}

            {(over || near || overHistorical) && (
              <p className={`text-xs ${over || overHistorical ? "text-danger" : "text-warning"}`}>
                {over && "Limite ultrapassado. "}
                {near && !over && "Próximo do limite. "}
                {overHistorical &&
                  `Gasto 30%+ acima da média dos últimos meses (${currencyFormatter.format(average ?? 0)}).`}
              </p>
            )}

            {suggested !== null && drafts[category.id] === undefined && (
              <p className="text-xs text-muted">
                Sugestão baseada na média dos últimos meses. Ajuste e salve, ou salve como está.
              </p>
            )}

            <div className="flex items-center gap-2">
              <input
                value={
                  drafts[category.id] ??
                  (limitAmount !== null
                    ? String(limitAmount)
                    : suggested !== null
                      ? String(suggested)
                      : "")
                }
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))
                }
                placeholder="Limite mensal"
                className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => handleSave(category.id)}
                className="rounded-lg border border-border px-2 py-1 text-xs text-foreground hover:bg-surface-hover"
              >
                Salvar
              </button>
              {budget && (
                <button
                  type="button"
                  onClick={() => handleDelete(budget.id, category.id)}
                  className="rounded-lg border border-border px-2 py-1 text-xs text-danger hover:bg-danger-soft"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
