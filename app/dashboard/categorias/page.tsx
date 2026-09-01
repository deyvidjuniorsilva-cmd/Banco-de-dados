"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listCategories, createCategory, type Category } from "@/lib/categories";
import {
  listCategoryRules,
  createCategoryRule,
  deleteCategoryRule,
  swapCategoryRulePositions,
  type CategoryRule,
} from "@/lib/category-rules";
import { errorMessage } from "@/lib/errors";
import { Card } from "@/components/card";

export default function CategoriasPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [categoryList, ruleList] = await Promise.all([
        listCategories(supabase),
        listCategoryRules(supabase),
      ]);
      setCategories(categoryList);
      setRules(ruleList);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(supabase, newCategoryName.trim());
      setNewCategoryName("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCreateRule() {
    if (!newKeyword.trim() || !newRuleCategoryId) return;
    try {
      await createCategoryRule(supabase, newKeyword.trim(), newRuleCategoryId);
      setNewKeyword("");
      setNewRuleCategoryId("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await deleteCategoryRule(supabase, id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleMoveRule(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;
    try {
      await swapCategoryRulePositions(supabase, rules[index], rules[targetIndex]);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function categoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "—";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Categorias</h1>
        <p className="text-sm text-muted">
          Gerencie suas categorias e as regras que categorizam transações
          automaticamente na revisão de importação.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full bg-surface-hover px-3 py-1 text-sm text-foreground"
            >
              {category.name}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nova categoria"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={handleCreateCategory}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            + Adicionar categoria
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground">
          Regras de categorização
        </h2>
        <p className="mt-1 text-xs text-muted">
          A primeira regra cuja palavra-chave aparecer na descrição da
          transação define a categoria sugerida. Ordem importa.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-[11px] font-semibold text-foreground">
                  {rule.keyword.slice(0, 2).toUpperCase()}
                </span>
                <span className="font-medium text-foreground">
                  &quot;{rule.keyword}&quot;
                </span>
                <span className="text-muted">→</span>
                <span className="text-foreground">
                  {categoryName(rule.categoryId)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveRule(index, "up")}
                  disabled={index === 0}
                  className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-hover disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveRule(index, "down")}
                  disabled={index === rules.length - 1}
                  className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-hover disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="rounded px-2 py-1 text-sm text-danger hover:bg-danger-soft"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted">Nenhuma regra cadastrada ainda.</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Palavra-chave (ex: uber)"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <select
            value={newRuleCategoryId}
            onChange={(e) => setNewRuleCategoryId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateRule}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
          >
            + Adicionar regra
          </button>
        </div>
      </Card>
    </div>
  );
}
