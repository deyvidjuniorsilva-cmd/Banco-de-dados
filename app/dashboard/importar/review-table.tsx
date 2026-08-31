"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { listCategories, createCategory, type Category } from "@/lib/categories";
import { listCategoryRules } from "@/lib/category-rules";
import { matchCategory } from "@/lib/categorization";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { listTransactionsForAccount, markDuplicateRows, type DuplicateCheckedRow } from "@/lib/transactions";
import { confirmarImport } from "./confirm-action";
import { errorMessage } from "@/lib/errors";

interface Row extends DuplicateCheckedRow {
  categoryId: string | null;
}

export function ReviewTable({
  importId,
  accountId,
  initialTransactions,
  onCancel,
}: {
  importId: string;
  accountId: string;
  initialTransactions: ParsedTransaction[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>(
    initialTransactions.map((t) => ({ ...t, categoryId: null, possibleDuplicate: false, included: true }))
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategorizationData() {
      try {
        const [categoryList, ruleList, existingTransactions] = await Promise.all([
          listCategories(supabase),
          listCategoryRules(supabase),
          listTransactionsForAccount(supabase, accountId),
        ]);
        setCategories(categoryList);
        setRows((prev) => {
          const withDuplicateFlags = markDuplicateRows(prev, existingTransactions);
          return withDuplicateFlags.map((row, i) => ({
            ...row,
            categoryId: prev[i].categoryId ?? matchCategory(row.description, ruleList),
          }));
        });
      } catch (err) {
        setError(`Falha ao carregar categorias: ${errorMessage(err)}`);
      }
    }
    loadCategorizationData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: 0,
        direction: "saida",
        categoryId: null,
        possibleDuplicate: false,
        included: true,
      },
    ]);
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      const category = await createCategory(supabase, newCategoryName.trim());
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoryName("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const response = await confirmarImport(importId, accountId, rows.filter((r) => r.included));
      if ("error" in response) {
        setError(response.error);
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError(`Falha inesperada: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">
        Revisar transações
      </h1>
      <p className="text-sm text-muted">
        Confira, corrija ou remova linhas antes de salvar. Nada foi gravado
        ainda.
      </p>

      {initialTransactions.length === 0 && (
        <p className="rounded-lg bg-surface-hover px-3 py-2 text-sm text-muted">
          Nenhuma transação foi encontrada neste PDF. Você pode adicionar
          linhas manualmente ou cancelar.
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nova categoria"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={handleCreateCategory}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
        >
          + Adicionar categoria
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-left text-muted">
            <tr>
              <th className="p-2">Incluir</th>
              <th className="p-2">Data</th>
              <th className="p-2">Descrição</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Direção</th>
              <th className="p-2">Categoria</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={row.included}
                    onChange={(e) => updateRow(index, { included: e.target.checked })}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(index, { date: e.target.value })}
                    className="w-36 rounded border border-border bg-background px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(index, { description: e.target.value })
                    }
                    className="w-64 rounded border border-border bg-background px-2 py-1"
                  />
                  {row.possibleDuplicate && (
                    <p className="mt-1 text-xs text-warning">
                      Possível duplicata — já lançado antes
                    </p>
                  )}
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) =>
                      updateRow(index, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 rounded border border-border bg-background px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={row.direction}
                    onChange={(e) =>
                      updateRow(index, {
                        direction: e.target.value as "entrada" | "saida",
                      })
                    }
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="saida">Saída</option>
                    <option value="entrada">Entrada</option>
                  </select>
                </td>
                <td className="p-2">
                  <select
                    value={row.categoryId ?? ""}
                    onChange={(e) =>
                      updateRow(index, { categoryId: e.target.value || null })
                    }
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-danger hover:underline"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
      >
        + Adicionar linha
      </button>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || rows.length === 0}
          className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? "Salvando..." : `Salvar ${rows.length} transações`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="w-fit rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-hover disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
