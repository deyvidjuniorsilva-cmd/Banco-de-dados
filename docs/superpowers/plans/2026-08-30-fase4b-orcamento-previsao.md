# Fase 4b — Orçamento, Previsão e Sugestões de Economia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual budget CRUD per category, next-month spending forecast per category, and a ranked savings-suggestions list to the existing Dashboard page.

**Architecture:** All new calculation logic (moving-average forecast, savings ranking, budget/historical alert predicates) lives as small pure functions in `lib/` files with colocated Vitest tests, following the existing convention where Supabase-calling wrapper functions stay thin and untested. The Dashboard server component (`app/dashboard/page.tsx`) fetches categories, budgets, and 3 months of prior category totals, runs the pure calculations, and passes plain data down to three new presentational/client components that replace the current placeholder "Alertas de orçamento" card.

**Tech Stack:** Next.js (App Router, TS, server components), Supabase (Postgres, RLS), Vitest, Tailwind utility classes (existing design tokens: `bg-surface`, `text-muted`, `text-danger`, `border-border`, etc.)

**Spec:** `docs/superpowers/specs/2026-08-30-fase4b-orcamento-previsao-design.md`

## Global Constraints

- N (history window for forecast/average) = 3 months, fixed (not user-configurable).
- Historical-variance alert threshold = >30% above average.
- Near-budget-limit alert threshold = within 10% of the limit (i.e. `currentSpend >= 0.9 * limitAmount`).
- Minimum 2 months of overall transaction history required before any forecast/suggestion is shown; below that, mark as "histórico insuficiente".
- Months with zero transactions in a category count as 0 in the average (never excluded from the denominator).
- Savings suggestions: only categories with `potentialSavings > 0`, capped at 5 entries, sorted descending.
- No new database migration — `budgets` table already exists (see `supabase/migrations/0001_init.sql:56-65`) with columns `id, owner, category_id, year, month, limit_amount, created_at` and unique constraint `(owner, category_id, year, month)`, RLS policy `owner_all_budgets` already covers all CRUD.
- Currency formatting: use the single shared formatter from `lib/format.ts` (created in Task 1) everywhere — do not redeclare `Intl.NumberFormat` locally.
- Test convention: colocated `*.test.ts` next to the source file, Vitest, `import { describe, it, expect } from "vitest"`. Only pure functions are unit-tested; thin Supabase wrapper functions (`.from(...)`) are not mocked/tested, matching existing code.

---

## Task 1: Extract shared currency formatter

**Files:**
- Create: `lib/format.ts`
- Modify: `app/dashboard/page.tsx:11-14` (remove local declaration, import from `lib/format`)
- Modify: `components/category-breakdown-chart.tsx:15-18` (remove local declaration, import from `lib/format`)
- Modify: `components/transactions-table.tsx:3-6` (remove local declaration, import from `lib/format`)

**Interfaces:**
- Produces: `export const currencyFormatter: Intl.NumberFormat` from `lib/format.ts`, used by Tasks 6-9.

This is a pure refactor (no behavior change), so no new test is needed — existing tests and a manual build check are the verification.

- [ ] **Step 1: Create the shared formatter file**

```ts
// lib/format.ts
export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
```

- [ ] **Step 2: Update `app/dashboard/page.tsx`**

Remove lines 11-14 (the local `currencyFormatter` declaration) and add to the import section:

```ts
import { currencyFormatter } from "@/lib/format";
```

- [ ] **Step 3: Update `components/category-breakdown-chart.tsx`**

Remove lines 15-18 (the local `currencyFormatter` declaration, keep `percentFormatter` as-is) and add:

```ts
import { currencyFormatter } from "@/lib/format";
```

- [ ] **Step 4: Update `components/transactions-table.tsx`**

Remove the local `currencyFormatter` declaration (lines 3-6) and add:

```ts
import { currencyFormatter } from "@/lib/format";
```

- [ ] **Step 5: Verify the build and existing tests still pass**

Run: `npm run build` and `npx vitest run`
Expected: build succeeds, all existing tests still pass (no behavior changed).

- [ ] **Step 6: Commit**

```bash
git add lib/format.ts app/dashboard/page.tsx components/category-breakdown-chart.tsx components/transactions-table.tsx
git commit -m "refactor: extract shared currencyFormatter to lib/format.ts"
```

---

## Task 2: Multi-month category totals data access

**Files:**
- Modify: `lib/dashboard.ts` (add `previousMonths` and `listCategoryTotalsForMonths`)
- Test: `lib/dashboard.test.ts` (add tests for `previousMonths`; this file already exists — check its current contents before adding, and append in the same style)

**Interfaces:**
- Consumes: `listTransactionsForMonth(supabase, year, month)` (`lib/dashboard.ts:84`), `buildMonthSummary(transactions)` (`lib/dashboard.ts:43`), both already defined.
- Produces:
  - `previousMonths(year: number, month: number, count: number): { year: number; month: number }[]` — pure, oldest first, does NOT include the given `year`/`month` itself.
  - `listCategoryTotalsForMonths(supabase: SupabaseClient, year: number, month: number, count: number): Promise<CategoryTotal[][]>` — thin wrapper, one array per month (oldest first), used by Tasks 3/4/9.

- [ ] **Step 1: Write the failing tests for `previousMonths`**

Add to `lib/dashboard.test.ts` (append to existing file, keep existing imports):

```ts
describe("previousMonths", () => {
  it("returns the requested count of months before the given month, oldest first", () => {
    expect(previousMonths(2026, 6, 3)).toEqual([
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
    ]);
  });

  it("rolls over to the previous year", () => {
    expect(previousMonths(2026, 2, 3)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
    ]);
  });

  it("rolls over across multiple years when count is large", () => {
    expect(previousMonths(2026, 1, 14)).toEqual([
      { year: 2024, month: 11 },
      { year: 2024, month: 12 },
      { year: 2025, month: 1 },
      { year: 2025, month: 2 },
      { year: 2025, month: 3 },
      { year: 2025, month: 4 },
      { year: 2025, month: 5 },
      { year: 2025, month: 6 },
      { year: 2025, month: 7 },
      { year: 2025, month: 8 },
      { year: 2025, month: 9 },
      { year: 2025, month: 10 },
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
    ]);
  });

  it("returns an empty array when count is 0", () => {
    expect(previousMonths(2026, 6, 0)).toEqual([]);
  });
});
```

Update the import line at the top of `lib/dashboard.test.ts` to include `previousMonths` alongside whatever is already imported from `../lib/dashboard` (adjust the relative path to match the existing import in that file).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/dashboard.test.ts`
Expected: FAIL with "previousMonths is not a function" or similar.

- [ ] **Step 3: Implement `previousMonths` in `lib/dashboard.ts`**

Add near the top of the file, after `buildMonthSummary` and before `pad2`:

```ts
export function previousMonths(
  year: number,
  month: number,
  count: number
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    result.unshift({ year: y, month: m });
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/dashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Add `listCategoryTotalsForMonths` (thin wrapper, no test)**

Add at the end of `lib/dashboard.ts`:

```ts
export async function listCategoryTotalsForMonths(
  supabase: SupabaseClient,
  year: number,
  month: number,
  count: number
): Promise<CategoryTotal[][]> {
  const months = previousMonths(year, month, count);
  const results: CategoryTotal[][] = [];
  for (const m of months) {
    const transactions = await listTransactionsForMonth(supabase, m.year, m.month);
    results.push(buildMonthSummary(transactions).porCategoria);
  }
  return results;
}
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all tests, including the new ones)

- [ ] **Step 7: Commit**

```bash
git add lib/dashboard.ts lib/dashboard.test.ts
git commit -m "feat: add previousMonths and listCategoryTotalsForMonths to lib/dashboard"
```

---

## Task 3: Forecast calculation (pure)

**Files:**
- Create: `lib/forecast.ts`
- Test: `lib/forecast.test.ts`

**Interfaces:**
- Consumes: `CategoryTotal` type from `lib/dashboard.ts` (`{ categoryId: string | null; categoryName: string; total: number }`).
- Produces:
  - `export interface CategoryForecast { categoryId: string | null; categoryName: string; forecast: number }`
  - `export function computeCategoryForecasts(monthlyTotals: CategoryTotal[][]): CategoryForecast[]` — used by Tasks 4, 7, 9.

- [ ] **Step 1: Write the failing tests**

Create `lib/forecast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCategoryForecasts } from "./forecast";
import type { CategoryTotal } from "./dashboard";

describe("computeCategoryForecasts", () => {
  it("returns an empty array when fewer than 2 months of history are available", () => {
    const oneMonth: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
    ];
    expect(computeCategoryForecasts(oneMonth)).toEqual([]);
    expect(computeCategoryForecasts([])).toEqual([]);
  });

  it("averages a category present in every month", () => {
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 600 }],
    ];
    const result = computeCategoryForecasts(history);
    expect(result).toEqual([
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 450 },
    ]);
  });

  it("treats a category missing from a month as zero spend that month", () => {
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Lazer", total: 300 }],
      [], // no spend in Lazer this month
      [{ categoryId: "cat-1", categoryName: "Lazer", total: 300 }],
    ];
    const result = computeCategoryForecasts(history);
    expect(result).toEqual([
      { categoryId: "cat-1", categoryName: "Lazer", forecast: 200 },
    ]);
  });

  it("includes every category seen in any month, sorted by categoryName", () => {
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
      [{ categoryId: "cat-2", categoryName: "Lazer", total: 100 }],
    ];
    const result = computeCategoryForecasts(history);
    expect(result).toEqual([
      { categoryId: "cat-2", categoryName: "Lazer", forecast: 50 },
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 150 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/forecast.test.ts`
Expected: FAIL with "Cannot find module './forecast'"

- [ ] **Step 3: Implement `lib/forecast.ts`**

```ts
import type { CategoryTotal } from "./dashboard";

export interface CategoryForecast {
  categoryId: string | null;
  categoryName: string;
  forecast: number;
}

export function computeCategoryForecasts(
  monthlyTotals: CategoryTotal[][]
): CategoryForecast[] {
  if (monthlyTotals.length < 2) return [];

  const monthCount = monthlyTotals.length;
  const sums = new Map<string, { categoryId: string | null; categoryName: string; sum: number }>();

  for (const monthTotals of monthlyTotals) {
    for (const entry of monthTotals) {
      const key = entry.categoryId ?? "sem-categoria";
      const existing = sums.get(key);
      if (existing) {
        existing.sum += entry.total;
      } else {
        sums.set(key, {
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          sum: entry.total,
        });
      }
    }
  }

  return Array.from(sums.values())
    .map((entry) => ({
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      forecast: entry.sum / monthCount,
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/forecast.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/forecast.ts lib/forecast.test.ts
git commit -m "feat: add computeCategoryForecasts moving-average calculation"
```

---

## Task 4: Savings suggestions ranking (pure)

**Files:**
- Modify: `lib/forecast.ts` (add `rankSavingsSuggestions`)
- Modify: `lib/forecast.test.ts` (add tests)

**Interfaces:**
- Consumes: `CategoryForecast` (Task 3), `CategoryTotal[][]` (same shape as `computeCategoryForecasts` input).
- Produces: `export interface SavingsSuggestion { categoryId: string | null; categoryName: string; forecast: number; bestRecentMonth: number; potentialSavings: number }` and `export function rankSavingsSuggestions(forecasts: CategoryForecast[], monthlyTotals: CategoryTotal[][], limit?: number): SavingsSuggestion[]` — used by Tasks 8, 9.

- [ ] **Step 1: Write the failing tests**

Append to `lib/forecast.test.ts`:

```ts
import { rankSavingsSuggestions } from "./forecast";

describe("rankSavingsSuggestions", () => {
  it("ranks categories by potential savings, descending", () => {
    const forecasts = [
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 500 },
      { categoryId: "cat-2", categoryName: "Lazer", forecast: 300 },
    ];
    const history: CategoryTotal[][] = [
      [
        { categoryId: "cat-1", categoryName: "Mercado", total: 400 },
        { categoryId: "cat-2", categoryName: "Lazer", total: 100 },
      ],
      [
        { categoryId: "cat-1", categoryName: "Mercado", total: 600 },
        { categoryId: "cat-2", categoryName: "Lazer", total: 500 },
      ],
    ];
    const result = rankSavingsSuggestions(forecasts, history);
    expect(result).toEqual([
      { categoryId: "cat-2", categoryName: "Lazer", forecast: 300, bestRecentMonth: 100, potentialSavings: 200 },
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 500, bestRecentMonth: 400, potentialSavings: 100 },
    ]);
  });

  it("excludes categories with zero or negative potential savings", () => {
    const forecasts = [
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 300 },
    ];
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
    ];
    expect(rankSavingsSuggestions(forecasts, history)).toEqual([]);
  });

  it("treats a month missing the category as zero when finding the best recent month", () => {
    const forecasts = [
      { categoryId: "cat-1", categoryName: "Lazer", forecast: 150 },
    ];
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Lazer", total: 300 }],
      [], // zero spend this month — the actual best recent month
    ];
    const result = rankSavingsSuggestions(forecasts, history);
    expect(result).toEqual([
      { categoryId: "cat-1", categoryName: "Lazer", forecast: 150, bestRecentMonth: 0, potentialSavings: 150 },
    ]);
  });

  it("caps the result at the given limit (default 5)", () => {
    const forecasts = Array.from({ length: 8 }, (_, i) => ({
      categoryId: `cat-${i}`,
      categoryName: `Categoria ${i}`,
      forecast: 100 + i,
    }));
    const history: CategoryTotal[][] = [
      forecasts.map((f) => ({ categoryId: f.categoryId, categoryName: f.categoryName, total: 0 })),
      forecasts.map((f) => ({ categoryId: f.categoryId, categoryName: f.categoryName, total: 0 })),
    ];
    const result = rankSavingsSuggestions(forecasts, history);
    expect(result).toHaveLength(5);
    expect(result[0].categoryId).toBe("cat-7");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/forecast.test.ts`
Expected: FAIL with "rankSavingsSuggestions is not a function"

- [ ] **Step 3: Implement `rankSavingsSuggestions` in `lib/forecast.ts`**

Add to `lib/forecast.ts`:

```ts
export interface SavingsSuggestion {
  categoryId: string | null;
  categoryName: string;
  forecast: number;
  bestRecentMonth: number;
  potentialSavings: number;
}

export function rankSavingsSuggestions(
  forecasts: CategoryForecast[],
  monthlyTotals: CategoryTotal[][],
  limit = 5
): SavingsSuggestion[] {
  const suggestions: SavingsSuggestion[] = [];

  for (const forecast of forecasts) {
    const key = forecast.categoryId ?? "sem-categoria";
    let bestRecentMonth = Infinity;
    for (const monthTotals of monthlyTotals) {
      const entry = monthTotals.find((t) => (t.categoryId ?? "sem-categoria") === key);
      const spend = entry?.total ?? 0;
      if (spend < bestRecentMonth) bestRecentMonth = spend;
    }
    if (bestRecentMonth === Infinity) bestRecentMonth = 0;

    const potentialSavings = forecast.forecast - bestRecentMonth;
    if (potentialSavings > 0) {
      suggestions.push({
        categoryId: forecast.categoryId,
        categoryName: forecast.categoryName,
        forecast: forecast.forecast,
        bestRecentMonth,
        potentialSavings,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.potentialSavings - a.potentialSavings)
    .slice(0, limit);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/forecast.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/forecast.ts lib/forecast.test.ts
git commit -m "feat: add rankSavingsSuggestions calculation"
```

---

## Task 5: Budgets data access and alert predicates

**Files:**
- Create: `lib/budgets.ts`
- Test: `lib/budgets.test.ts` (only for the pure predicates)

**Interfaces:**
- Produces:
  - `export interface Budget { id: string; categoryId: string; year: number; month: number; limitAmount: number }`
  - `export async function listBudgetsForMonth(supabase: SupabaseClient, year: number, month: number): Promise<Budget[]>` — thin wrapper, untested.
  - `export async function upsertBudget(supabase: SupabaseClient, categoryId: string, year: number, month: number, limitAmount: number): Promise<Budget>` — thin wrapper, untested.
  - `export function isOverBudget(currentSpend: number, limitAmount: number | null): boolean`
  - `export function isNearBudgetLimit(currentSpend: number, limitAmount: number | null): boolean` (uses the 0.9 threshold from Global Constraints)
  - `export function isOverHistoricalAverage(currentSpend: number, average: number | null): boolean` (uses the 30% threshold from Global Constraints)
- Consumed by: Task 6 (`budget-list.tsx`), Task 9 (dashboard wiring).

- [ ] **Step 1: Write the failing tests for the alert predicates**

Create `lib/budgets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isOverBudget, isNearBudgetLimit, isOverHistoricalAverage } from "./budgets";

describe("isOverBudget", () => {
  it("is false when there is no limit set", () => {
    expect(isOverBudget(500, null)).toBe(false);
  });
  it("is false when spend equals the limit exactly", () => {
    expect(isOverBudget(500, 500)).toBe(false);
  });
  it("is true when spend exceeds the limit", () => {
    expect(isOverBudget(500.01, 500)).toBe(true);
  });
});

describe("isNearBudgetLimit", () => {
  it("is false when there is no limit set", () => {
    expect(isNearBudgetLimit(450, null)).toBe(false);
  });
  it("is true at exactly 90% of the limit", () => {
    expect(isNearBudgetLimit(450, 500)).toBe(true);
  });
  it("is false just below 90% of the limit", () => {
    expect(isNearBudgetLimit(449.99, 500)).toBe(false);
  });
});

describe("isOverHistoricalAverage", () => {
  it("is false when there is no average available", () => {
    expect(isOverHistoricalAverage(500, null)).toBe(false);
  });
  it("is true at exactly 30% above the average", () => {
    expect(isOverHistoricalAverage(130, 100)).toBe(true);
  });
  it("is false just below 30% above the average", () => {
    expect(isOverHistoricalAverage(129.99, 100)).toBe(false);
  });
  it("is false when the average is zero", () => {
    expect(isOverHistoricalAverage(50, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/budgets.test.ts`
Expected: FAIL with "Cannot find module './budgets'"

- [ ] **Step 3: Implement `lib/budgets.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Budget {
  id: string;
  categoryId: string;
  year: number;
  month: number;
  limitAmount: number;
}

function fromRow(row: {
  id: string;
  category_id: string;
  year: number;
  month: number;
  limit_amount: number;
}): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    year: row.year,
    month: row.month,
    limitAmount: row.limit_amount,
  };
}

export async function listBudgetsForMonth(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, category_id, year, month, limit_amount")
    .eq("year", year)
    .eq("month", month);
  if (error) throw error;
  return data.map(fromRow);
}

export async function upsertBudget(
  supabase: SupabaseClient,
  categoryId: string,
  year: number,
  month: number,
  limitAmount: number
): Promise<Budget> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { owner: user.id, category_id: categoryId, year, month, limit_amount: limitAmount },
      { onConflict: "owner,category_id,year,month" }
    )
    .select("id, category_id, year, month, limit_amount")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export function isOverBudget(currentSpend: number, limitAmount: number | null): boolean {
  if (limitAmount === null) return false;
  return currentSpend > limitAmount;
}

export function isNearBudgetLimit(currentSpend: number, limitAmount: number | null): boolean {
  if (limitAmount === null) return false;
  return currentSpend >= 0.9 * limitAmount;
}

export function isOverHistoricalAverage(currentSpend: number, average: number | null): boolean {
  if (average === null || average === 0) return false;
  return currentSpend >= 1.3 * average;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/budgets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/budgets.ts lib/budgets.test.ts
git commit -m "feat: add budgets data access and alert predicates"
```

---

## Task 6: Budget list client component (CRUD + alerts)

**Files:**
- Create: `components/budget-list.tsx`

**Interfaces:**
- Consumes: `Budget`, `upsertBudget` from `lib/budgets.ts` (Task 5); `isOverBudget`, `isNearBudgetLimit`, `isOverHistoricalAverage` from `lib/budgets.ts`; `errorMessage` from `lib/errors.ts`; `currencyFormatter` from `lib/format.ts`; `createClient` from `lib/supabase/client`.
- Props:

```ts
interface BudgetListProps {
  year: number;
  month: number;
  categories: { id: string; name: string }[];
  initialBudgets: Budget[];
  currentSpendByCategory: Record<string, number>; // key = categoryId, value = spend this month
  historicalAverageByCategory: Record<string, number>; // key = categoryId, value = avg of last 3 months (only present when forecast available)
}
```

No dedicated unit test for this component (matches existing convention — UI components aren't unit-tested in this codebase); verify manually in the browser in Task 9.

- [ ] **Step 1: Implement `components/budget-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  upsertBudget,
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

  async function handleSave(categoryId: string) {
    const raw = drafts[categoryId];
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
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
                <div
                  className={`h-full ${over ? "bg-danger" : near ? "bg-warning" : "bg-brand"}`}
                  style={{ width: `${progress * 100}%` }}
                />
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

            <div className="flex items-center gap-2">
              <input
                value={drafts[category.id] ?? (limitAmount !== null ? String(limitAmount) : "")}
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/budget-list.tsx
git commit -m "feat: add BudgetList client component with limit and historical alerts"
```

---

## Task 7: Forecast cards component

**Files:**
- Create: `components/forecast-cards.tsx`

**Interfaces:**
- Consumes: `CategoryForecast` from `lib/forecast.ts` (Task 3), `currencyFormatter` from `lib/format.ts`.
- Props: `{ forecasts: CategoryForecast[]; budgetLimitByCategory: Record<string, number> }`

- [ ] **Step 1: Implement `components/forecast-cards.tsx`**

```tsx
import type { CategoryForecast } from "@/lib/forecast";
import { currencyFormatter } from "@/lib/format";

interface ForecastCardsProps {
  forecasts: CategoryForecast[];
  budgetLimitByCategory: Record<string, number>;
}

export function ForecastCards({ forecasts, budgetLimitByCategory }: ForecastCardsProps) {
  if (forecasts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
        Disponível após 2 meses de histórico
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {forecasts.map((forecast) => {
        const key = forecast.categoryId ?? "sem-categoria";
        const limitAmount = budgetLimitByCategory[key];
        const overLimit = limitAmount !== undefined && forecast.forecast > limitAmount;

        return (
          <div key={key} className="rounded-lg border border-border px-3 py-2">
            <p className="text-sm font-medium text-foreground">{forecast.categoryName}</p>
            <p className={`mt-1 text-lg font-semibold ${overLimit ? "text-danger" : "text-foreground"}`}>
              {currencyFormatter.format(forecast.forecast)}
            </p>
            {limitAmount !== undefined && (
              <p className="mt-1 text-xs text-muted">
                Limite: {currencyFormatter.format(limitAmount)}
                {overLimit && " · previsão acima do limite"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/forecast-cards.tsx
git commit -m "feat: add ForecastCards presentational component"
```

---

## Task 8: Savings suggestions component

**Files:**
- Create: `components/savings-suggestions.tsx`

**Interfaces:**
- Consumes: `SavingsSuggestion` from `lib/forecast.ts` (Task 4), `currencyFormatter` from `lib/format.ts`.
- Props: `{ suggestions: SavingsSuggestion[] }`

- [ ] **Step 1: Implement `components/savings-suggestions.tsx`**

```tsx
import type { SavingsSuggestion } from "@/lib/forecast";
import { currencyFormatter } from "@/lib/format";

export function SavingsSuggestions({ suggestions }: { suggestions: SavingsSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted">Nenhuma categoria com corte óbvio este mês.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((suggestion) => (
        <li
          key={suggestion.categoryId ?? "sem-categoria"}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
        >
          Reduzindo <strong>{suggestion.categoryName}</strong> para o nível do seu
          melhor mês recente ({currencyFormatter.format(suggestion.bestRecentMonth)}),
          você economiza {currencyFormatter.format(suggestion.potentialSavings)}.
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add components/savings-suggestions.tsx
git commit -m "feat: add SavingsSuggestions presentational component"
```

---

## Task 9: Wire everything into the Dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `listCategories` (`lib/categories.ts`), `listBudgetsForMonth` (`lib/budgets.ts`, Task 5), `listCategoryTotalsForMonths` (`lib/dashboard.ts`, Task 2), `computeCategoryForecasts`/`rankSavingsSuggestions` (`lib/forecast.ts`, Tasks 3-4), `BudgetList` (Task 6), `ForecastCards` (Task 7), `SavingsSuggestions` (Task 8).

- [ ] **Step 1: Update imports and fetch the new data**

Replace the import block and the body of `DashboardPage` in `app/dashboard/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/card";
import { MonthNav } from "@/components/month-nav";
import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { BudgetList } from "@/components/budget-list";
import { ForecastCards } from "@/components/forecast-cards";
import { SavingsSuggestions } from "@/components/savings-suggestions";
import {
  listTransactionsForMonth,
  buildMonthSummary,
  resolveMonthParams,
  listCategoryTotalsForMonths,
} from "@/lib/dashboard";
import { listCategories } from "@/lib/categories";
import { listBudgetsForMonth } from "@/lib/budgets";
import { computeCategoryForecasts, rankSavingsSuggestions } from "@/lib/forecast";
import { currencyFormatter } from "@/lib/format";

const FORECAST_HISTORY_MONTHS = 3;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string | string[]; mes?: string | string[] }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();

  const [transactions, categories, budgets, monthlyHistory] = await Promise.all([
    listTransactionsForMonth(supabase, year, month),
    listCategories(supabase),
    listBudgetsForMonth(supabase, year, month),
    listCategoryTotalsForMonths(supabase, year, month, FORECAST_HISTORY_MONTHS),
  ]);

  const summary = buildMonthSummary(transactions);
  const monthQuery = `?ano=${year}&mes=${month}`;

  const forecasts = computeCategoryForecasts(monthlyHistory);
  const savingsSuggestions = rankSavingsSuggestions(forecasts, monthlyHistory);

  const currentSpendByCategory: Record<string, number> = {};
  for (const entry of summary.porCategoria) {
    if (entry.categoryId) currentSpendByCategory[entry.categoryId] = entry.total;
  }

  const historicalAverageByCategory: Record<string, number> = {};
  for (const forecast of forecasts) {
    if (forecast.categoryId) historicalAverageByCategory[forecast.categoryId] = forecast.forecast;
  }

  const budgetLimitByCategory: Record<string, number> = {};
  for (const budget of budgets) {
    budgetLimitByCategory[budget.categoryId] = budget.limitAmount;
  }
```

- [ ] **Step 2: Replace the placeholder "Alertas de orçamento" card**

Replace lines 87-94 (the final `<Card>` block with "Nenhum orçamento configurado ainda") with:

```tsx
      <Card className="min-h-64">
        <h2 className="text-sm font-semibold text-foreground">
          Orçamento por categoria
        </h2>
        <div className="mt-4">
          <BudgetList
            year={year}
            month={month}
            categories={categories}
            initialBudgets={budgets}
            currentSpendByCategory={currentSpendByCategory}
            historicalAverageByCategory={historicalAverageByCategory}
          />
        </div>
      </Card>

      <Card className="min-h-64">
        <h2 className="text-sm font-semibold text-foreground">
          Previsão do próximo mês
        </h2>
        <div className="mt-4">
          <ForecastCards forecasts={forecasts} budgetLimitByCategory={budgetLimitByCategory} />
        </div>
      </Card>

      <Card className="min-h-64">
        <h2 className="text-sm font-semibold text-foreground">
          Sugestões de economia
        </h2>
        <div className="mt-4">
          <SavingsSuggestions suggestions={savingsSuggestions} />
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Run the full test suite and build**

Run: `npx vitest run` and `npm run build`
Expected: all tests pass, build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run dev`, open the dashboard.
Check:
- Budget list shows every category, lets you type a limit and click Salvar, and the value persists after a page reload.
- Setting a limit below current spend shows the "Limite ultrapassado" alert with a red progress bar.
- With fewer than 2 months of transaction history in the account, the forecast and savings sections show their empty states ("Disponível após 2 meses de histórico" / "Nenhuma categoria com corte óbvio este mês") instead of erroring.
- If the account already has 2+ months of data, forecast cards and at least one savings suggestion render with plausible values matching the transaction history.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: wire budget CRUD, forecast, and savings suggestions into dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** budget CRUD (Task 6), historical-variance + limit alerts (Tasks 5-6), forecast (Tasks 2-3, 7), savings suggestions (Task 4, 8), dashboard layout order (Task 9), tests for calculation logic (Tasks 2-5). "Fora de escopo" items (recurring-expense detection, installment-aware forecast, user savings goal, WhatsApp reconciliation) are intentionally not covered.
- **Type consistency checked:** `CategoryForecast.categoryId` and `SavingsSuggestion.categoryId` are `string | null` throughout, matching `CategoryTotal.categoryId` from `lib/dashboard.ts`; `Budget.categoryId` is `string` (never null, matching the DB's `not null` FK) — components key on `category.id` (always a real category) when reading `budgetLimitByCategory`/`historicalAverageByCategory`/`currentSpendByCategory`, so the `null` case only ever appears inside forecast/savings data, never inside budget data. `currencyFormatter` imported from `lib/format.ts` everywhere after Task 1.
