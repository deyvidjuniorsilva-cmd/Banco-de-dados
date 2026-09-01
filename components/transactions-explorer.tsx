"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateTransactionCategory, deleteTransaction } from "@/lib/transactions";
import { errorMessage } from "@/lib/errors";
import type { DashboardTransaction } from "@/lib/dashboard";
import type { Category } from "@/lib/categories";
import { groupByDay, initialsFor } from "@/lib/transaction-display";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatDate(occurredOn: string): string {
  const [year, month, day] = occurredOn.split("-");
  return `${day}/${month}/${year}`;
}

type DirectionFilter = "todas" | "entrada" | "saida";
const SEM_CATEGORIA = "sem-categoria";

export function TransactionsExplorer({
  transactions,
  categories,
}: {
  transactions: DashboardTransaction[];
  categories: Category[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(transactions);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("todas");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (term && !row.description.toLowerCase().includes(term)) return false;
      if (direction !== "todas" && row.direction !== direction) return false;
      if (categoryFilter === SEM_CATEGORIA && row.categoryId !== null) return false;
      if (
        categoryFilter &&
        categoryFilter !== SEM_CATEGORIA &&
        row.categoryId !== categoryFilter
      )
        return false;
      return true;
    });
  }, [rows, search, direction, categoryFilter]);

  async function handleCategoryChange(id: string, categoryId: string) {
    const resolvedId = categoryId || null;
    const previous = rows;
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              categoryId: resolvedId,
              categoryName:
                categories.find((c) => c.id === resolvedId)?.name ?? null,
            }
          : row
      )
    );
    try {
      await updateTransactionCategory(supabase, id, resolvedId);
    } catch (err) {
      setRows(previous);
      setError(errorMessage(err));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir esta transação? Essa ação não pode ser desfeita.")) {
      return;
    }
    const previous = rows;
    setRows((current) => current.filter((row) => row.id !== id));
    try {
      await deleteTransaction(supabase, id);
    } catch (err) {
      setRows(previous);
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descrição"
          className="min-w-48 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        />
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as DirectionFilter)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="todas">Todas</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Todas as categorias</option>
          <option value={SEM_CATEGORIA}>Sem categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <p className="rounded-lg bg-surface-hover px-3 py-2 text-sm text-muted">
          Nenhuma transação encontrada.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 md:hidden">
            {groupByDay(filteredRows).map((group) => (
              <div key={group.label}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{group.label}</p>
                <div className="mt-2 flex flex-col gap-3">
                  {group.items.map((row) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[11px] font-semibold text-foreground">
                        {initialsFor(row.description)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{row.description}</p>
                        <select
                          value={row.categoryId ?? ""}
                          onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                          className="mt-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
                        >
                          <option value="">Sem categoria</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p
                          className={`text-sm font-semibold ${
                            row.direction === "entrada" ? "text-success" : "text-danger"
                          }`}
                        >
                          {row.direction === "saida" ? "-" : ""}
                          {currencyFormatter.format(row.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
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
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="p-2 whitespace-nowrap">{formatDate(row.occurredOn)}</td>
                    <td className="p-2">{row.description}</td>
                    <td className="p-2">
                      <select
                        value={row.categoryId ?? ""}
                        onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                      >
                        <option value="">Sem categoria</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className={`p-2 whitespace-nowrap ${
                        row.direction === "entrada" ? "text-success" : "text-danger"
                      }`}
                    >
                      {row.direction === "saida" ? "-" : ""}
                      {currencyFormatter.format(row.amount)}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="rounded px-2 py-1 text-sm text-danger hover:bg-danger-soft"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
