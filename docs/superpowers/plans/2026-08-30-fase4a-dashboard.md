# Fase 4a — Dashboard com Dados Reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os placeholders do dashboard (`/dashboard`) e das páginas de detalhe (`/dashboard/gastos`, `/dashboard/receitas`, `/dashboard/saldo`) por dados reais das transações do usuário, com navegação entre meses e um gráfico donut de gastos por categoria.

**Architecture:** Camada de dados pura (`lib/dashboard.ts`) separa busca impura (`listTransactionsForMonth`, consulta Supabase) de cálculo puro e testável (`buildMonthSummary`, `resolveMonthParams`), seguindo o padrão já usado em `lib/category-rules.ts` / `lib/categorization.ts`. As páginas do dashboard viram Server Components assíncronos que leem `searchParams` (`?ano=&mes=`) para o mês selecionado, sem estado de cliente. Componentes de UI reutilizáveis (`MonthNav`, `TransactionsTable`, `CategoryDonutChart`) evitam duplicar markup entre as 4 páginas.

**Tech Stack:** Next.js 16 (App Router, Server Components, `searchParams` como `Promise`), TypeScript, Supabase (`@supabase/supabase-js`), `recharts` (novo, para o gráfico donut), Tailwind CSS (classes já usadas no projeto: `text-foreground`, `text-muted`, `text-success`, `text-danger`, `bg-surface`, `border-border`, etc), Vitest para testes unitários.

**Spec:** `docs/superpowers/specs/2026-08-30-fase4a-dashboard-design.md`

## Global Constraints

- Query params do mês: `?ano=YYYY&mes=M` (M sem zero à esquerda), usados em todas as 4 páginas do dashboard.
- Sem parâmetros → mês atual (data do servidor).
- `porCategoria` inclui apenas transações de saída (`direction: "saida"`); transações sem `category_id` entram no grupo `"Sem categoria"`.
- Nenhuma dependência nova além de `recharts`.
- Sem testes de integração/e2e novos — só unitários (vitest) para as funções puras, seguindo o padrão já usado no projeto (ex.: `lib/categorization.test.ts`).
- Todo texto de UI em português, consistente com o resto do app.

---

### Task 1: Adicionar dependência `recharts`

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: pacote `recharts` disponível para import em componentes client (`"use client"`).

- [ ] **Step 1: Instalar o pacote**

Run: `npm install recharts`

Expected: `package.json` e `package-lock.json` atualizados com `recharts` em `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for dashboard chart"
```

---

### Task 2: `lib/dashboard.ts` — camada de dados e cálculo do resumo mensal (TDD)

**Files:**
- Create: `lib/dashboard.ts`
- Test: `lib/dashboard.test.ts`

**Interfaces:**
- Produces:
  - `interface DashboardTransaction { id: string; occurredOn: string; description: string; amount: number; direction: "entrada" | "saida"; categoryId: string | null; categoryName: string | null; }`
  - `interface CategoryTotal { categoryId: string | null; categoryName: string; total: number; }`
  - `interface MonthSummary { saldo: number; receitas: number; gastos: number; porCategoria: CategoryTotal[]; }`
  - `function resolveMonthParams(searchParams: { ano?: string; mes?: string }): { year: number; month: number }`
  - `function buildMonthSummary(transactions: DashboardTransaction[]): MonthSummary`
  - `function listTransactionsForMonth(supabase: SupabaseClient, year: number, month: number): Promise<DashboardTransaction[]>`
- Consumes: nada (é a base da Fase 4a).

- [ ] **Step 1: Escrever os testes de `resolveMonthParams` e `buildMonthSummary`**

Create `lib/dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveMonthParams, buildMonthSummary, type DashboardTransaction } from "./dashboard";

describe("resolveMonthParams", () => {
  it("usa o mês atual quando não há parâmetros", () => {
    const now = new Date();
    const result = resolveMonthParams({});
    expect(result).toEqual({ year: now.getFullYear(), month: now.getMonth() + 1 });
  });

  it("usa ano e mês da URL quando fornecidos", () => {
    const result = resolveMonthParams({ ano: "2026", mes: "3" });
    expect(result).toEqual({ year: 2026, month: 3 });
  });
});

describe("buildMonthSummary", () => {
  it("retorna totais zerados e porCategoria vazio para mês sem transações", () => {
    const result = buildMonthSummary([]);
    expect(result).toEqual({ saldo: 0, receitas: 0, gastos: 0, porCategoria: [] });
  });

  it("calcula saldo, receitas e gastos misturando entrada e saída", () => {
    const transactions: DashboardTransaction[] = [
      {
        id: "1",
        occurredOn: "2026-08-05",
        description: "Salário",
        amount: 5000,
        direction: "entrada",
        categoryId: null,
        categoryName: null,
      },
      {
        id: "2",
        occurredOn: "2026-08-10",
        description: "Mercado",
        amount: 300,
        direction: "saida",
        categoryId: "cat-mercado",
        categoryName: "Mercado",
      },
    ];

    const result = buildMonthSummary(transactions);

    expect(result.receitas).toBe(5000);
    expect(result.gastos).toBe(300);
    expect(result.saldo).toBe(4700);
  });

  it("agrupa transações sem categoria em 'Sem categoria'", () => {
    const transactions: DashboardTransaction[] = [
      {
        id: "1",
        occurredOn: "2026-08-05",
        description: "Compra avulsa",
        amount: 50,
        direction: "saida",
        categoryId: null,
        categoryName: null,
      },
    ];

    const result = buildMonthSummary(transactions);

    expect(result.porCategoria).toEqual([
      { categoryId: null, categoryName: "Sem categoria", total: 50 },
    ]);
  });

  it("soma múltiplas transações da mesma categoria e ordena por total decrescente", () => {
    const transactions: DashboardTransaction[] = [
      {
        id: "1",
        occurredOn: "2026-08-01",
        description: "Uber",
        amount: 20,
        direction: "saida",
        categoryId: "cat-transporte",
        categoryName: "Transporte",
      },
      {
        id: "2",
        occurredOn: "2026-08-02",
        description: "Mercado",
        amount: 300,
        direction: "saida",
        categoryId: "cat-mercado",
        categoryName: "Mercado",
      },
      {
        id: "3",
        occurredOn: "2026-08-03",
        description: "99",
        amount: 15,
        direction: "saida",
        categoryId: "cat-transporte",
        categoryName: "Transporte",
      },
    ];

    const result = buildMonthSummary(transactions);

    expect(result.porCategoria).toEqual([
      { categoryId: "cat-mercado", categoryName: "Mercado", total: 300 },
      { categoryId: "cat-transporte", categoryName: "Transporte", total: 35 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

Run: `npm run test -- --run lib/dashboard.test.ts`
Expected: FAIL — `Cannot find module './dashboard'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `lib/dashboard.ts`**

Create `lib/dashboard.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardTransaction {
  id: string;
  occurredOn: string;
  description: string;
  amount: number;
  direction: "entrada" | "saida";
  categoryId: string | null;
  categoryName: string | null;
}

export interface CategoryTotal {
  categoryId: string | null;
  categoryName: string;
  total: number;
}

export interface MonthSummary {
  saldo: number;
  receitas: number;
  gastos: number;
  porCategoria: CategoryTotal[];
}

export function resolveMonthParams(searchParams: {
  ano?: string;
  mes?: string;
}): { year: number; month: number } {
  const now = new Date();
  const year = searchParams.ano ? parseInt(searchParams.ano, 10) : now.getFullYear();
  const month = searchParams.mes ? parseInt(searchParams.mes, 10) : now.getMonth() + 1;
  return { year, month };
}

export function buildMonthSummary(transactions: DashboardTransaction[]): MonthSummary {
  let receitas = 0;
  let gastos = 0;
  const categoryTotals = new Map<string, CategoryTotal>();

  for (const transaction of transactions) {
    if (transaction.direction === "entrada") {
      receitas += transaction.amount;
      continue;
    }

    gastos += transaction.amount;
    const key = transaction.categoryId ?? "sem-categoria";
    const existing = categoryTotals.get(key);
    if (existing) {
      existing.total += transaction.amount;
    } else {
      categoryTotals.set(key, {
        categoryId: transaction.categoryId,
        categoryName: transaction.categoryName ?? "Sem categoria",
        total: transaction.amount,
      });
    }
  }

  const porCategoria = Array.from(categoryTotals.values()).sort(
    (a, b) => b.total - a.total
  );

  return {
    saldo: receitas - gastos,
    receitas,
    gastos,
    porCategoria,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export async function listTransactionsForMonth(
  supabase: SupabaseClient,
  year: number,
  month: number
): Promise<DashboardTransaction[]> {
  const start = `${year}-${pad2(month)}-01`;
  const nextMonthDate = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = `${nextMonthDate.year}-${pad2(nextMonthDate.month)}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("id, occurred_on, description, amount, direction, category_id, categories(name)")
    .gte("occurred_on", start)
    .lt("occurred_on", end)
    .order("occurred_on", { ascending: false });
  if (error) throw error;

  return data.map((row: {
    id: string;
    occurred_on: string;
    description: string;
    amount: number;
    direction: "entrada" | "saida";
    category_id: string | null;
    categories: { name: string } | null;
  }) => ({
    id: row.id,
    occurredOn: row.occurred_on,
    description: row.description,
    amount: row.amount,
    direction: row.direction,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? null,
  }));
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

Run: `npm run test -- --run lib/dashboard.test.ts`
Expected: PASS — 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard.ts lib/dashboard.test.ts
git commit -m "feat: add month summary calculation and transaction data access"
```

---

### Task 3: `components/month-nav.tsx` — navegação entre meses

**Files:**
- Create: `components/month-nav.tsx`

**Interfaces:**
- Consumes: nada (recebe `year`/`month` já resolvidos pela página via `resolveMonthParams`).
- Produces: `function MonthNav({ pathname, year, month }: { pathname: string; year: number; month: number }): JSX.Element`

- [ ] **Step 1: Criar o componente**

Create `components/month-nav.tsx`:

```tsx
import Link from "next/link";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function MonthNav({
  pathname,
  year,
  month,
}: {
  pathname: string;
  year: number;
  month: number;
}) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`${pathname}?ano=${prev.year}&mes=${prev.month}`}
        className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-surface-hover"
        aria-label="Mês anterior"
      >
        ‹
      </Link>
      <span className="min-w-32 text-center text-sm font-medium text-foreground">
        {MESES[month - 1]} {year}
      </span>
      <Link
        href={`${pathname}?ano=${next.year}&mes=${next.month}`}
        className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-surface-hover"
        aria-label="Próximo mês"
      >
        ›
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/month-nav.tsx
git commit -m "feat: add month navigation component"
```

---

### Task 4: `components/transactions-table.tsx` — tabela de transações do mês

**Files:**
- Create: `components/transactions-table.tsx`

**Interfaces:**
- Consumes: `DashboardTransaction` de `@/lib/dashboard`.
- Produces: `function TransactionsTable({ transactions }: { transactions: DashboardTransaction[] }): JSX.Element`

- [ ] **Step 1: Criar o componente**

Create `components/transactions-table.tsx`:

```tsx
import type { DashboardTransaction } from "@/lib/dashboard";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

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
```

- [ ] **Step 2: Commit**

```bash
git add components/transactions-table.tsx
git commit -m "feat: add shared transactions table component"
```

---

### Task 5: `components/category-donut-chart.tsx` — gráfico de gastos por categoria

**Files:**
- Create: `components/category-donut-chart.tsx`

**Interfaces:**
- Consumes: `CategoryTotal[]` de `@/lib/dashboard`.
- Produces: `function CategoryDonutChart({ data }: { data: CategoryTotal[] }): JSX.Element`

- [ ] **Step 1: Criar o componente client**

Create `components/category-donut-chart.tsx`:

```tsx
"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { CategoryTotal } from "@/lib/dashboard";

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#a855f7",
  "#ef4444",
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function CategoryDonutChart({ data }: { data: CategoryTotal[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
        Disponível após o upload do primeiro extrato
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryName"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.categoryId ?? "sem-categoria"}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => currencyFormatter.format(value)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/category-donut-chart.tsx
git commit -m "feat: add category spending donut chart"
```

---

### Task 6: `app/dashboard/page.tsx` — dashboard com dados reais

**Files:**
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `resolveMonthParams`, `listTransactionsForMonth`, `buildMonthSummary` de `@/lib/dashboard`; `createClient` de `@/lib/supabase/server`; `MonthNav` de `@/components/month-nav`; `CategoryDonutChart` de `@/components/category-donut-chart`; `Card` de `@/components/card`.

- [ ] **Step 1: Reescrever a página como Server Component assíncrono**

Replace the full contents of `app/dashboard/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/card";
import { MonthNav } from "@/components/month-nav";
import { CategoryDonutChart } from "@/components/category-donut-chart";
import {
  listTransactionsForMonth,
  buildMonthSummary,
  resolveMonthParams,
} from "@/lib/dashboard";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = await listTransactionsForMonth(supabase, year, month);
  const summary = buildMonthSummary(transactions);
  const monthQuery = `?ano=${year}&mes=${month}`;

  const summaryCards = [
    {
      label: "Saldo do mês",
      tone: "default" as const,
      href: `/dashboard/saldo${monthQuery}`,
      value: summary.saldo,
    },
    {
      label: "Receitas do mês",
      tone: "success" as const,
      href: `/dashboard/receitas${monthQuery}`,
      value: summary.receitas,
    },
    {
      label: "Gastos do mês",
      tone: "danger" as const,
      href: `/dashboard/gastos${monthQuery}`,
      value: summary.gastos,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">Resumo do mês selecionado.</p>
        </div>
        <MonthNav pathname="/dashboard" year={year} month={month} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.label} href={card.href}>
            <p className="text-sm text-muted">{card.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                card.tone === "success"
                  ? "text-success"
                  : card.tone === "danger"
                    ? "text-danger"
                    : "text-foreground"
              }`}
            >
              {currencyFormatter.format(card.value)}
            </p>
            <p className="mt-3 text-xs font-medium text-brand">Ver detalhes →</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-h-64">
          <h2 className="text-sm font-semibold text-foreground">
            Gastos por categoria
          </h2>
          <div className="mt-4">
            <CategoryDonutChart data={summary.porCategoria} />
          </div>
        </Card>

        <Card className="min-h-64">
          <h2 className="text-sm font-semibold text-foreground">
            Alertas de orçamento
          </h2>
          <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
            Nenhum orçamento configurado ainda
          </div>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e lint**

Run: `npm run lint`
Expected: sem erros novos relacionados a `app/dashboard/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: wire real month data into dashboard summary and chart"
```

---

### Task 7: Páginas de detalhe (`gastos`, `receitas`, `saldo`) com lista real de transações

**Files:**
- Modify: `app/dashboard/gastos/page.tsx`
- Modify: `app/dashboard/receitas/page.tsx`
- Modify: `app/dashboard/saldo/page.tsx`
- Delete: `components/coming-soon-detail.tsx`

**Interfaces:**
- Consumes: `resolveMonthParams`, `listTransactionsForMonth` de `@/lib/dashboard`; `createClient` de `@/lib/supabase/server`; `MonthNav` de `@/components/month-nav`; `TransactionsTable` de `@/components/transactions-table`.

- [ ] **Step 1: Reescrever `app/dashboard/gastos/page.tsx`**

Replace the full contents of `app/dashboard/gastos/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "@/components/month-nav";
import { TransactionsTable } from "@/components/transactions-table";
import { listTransactionsForMonth, resolveMonthParams } from "@/lib/dashboard";

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = (await listTransactionsForMonth(supabase, year, month)).filter(
    (transaction) => transaction.direction === "saida"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted transition-colors hover:text-brand"
          >
            ← Voltar ao dashboard
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Gastos do mês
          </h1>
          <p className="text-sm text-muted">
            Todas as saídas que compõem os gastos do mês selecionado.
          </p>
        </div>
        <MonthNav pathname="/dashboard/gastos" year={year} month={month} />
      </div>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
```

- [ ] **Step 2: Reescrever `app/dashboard/receitas/page.tsx`**

Replace the full contents of `app/dashboard/receitas/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "@/components/month-nav";
import { TransactionsTable } from "@/components/transactions-table";
import { listTransactionsForMonth, resolveMonthParams } from "@/lib/dashboard";

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = (await listTransactionsForMonth(supabase, year, month)).filter(
    (transaction) => transaction.direction === "entrada"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted transition-colors hover:text-brand"
          >
            ← Voltar ao dashboard
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Receitas do mês
          </h1>
          <p className="text-sm text-muted">
            Todas as entradas que compõem as receitas do mês selecionado.
          </p>
        </div>
        <MonthNav pathname="/dashboard/receitas" year={year} month={month} />
      </div>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
```

- [ ] **Step 3: Reescrever `app/dashboard/saldo/page.tsx`**

Replace the full contents of `app/dashboard/saldo/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "@/components/month-nav";
import { TransactionsTable } from "@/components/transactions-table";
import { listTransactionsForMonth, resolveMonthParams } from "@/lib/dashboard";

export default async function SaldoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = await listTransactionsForMonth(supabase, year, month);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted transition-colors hover:text-brand"
          >
            ← Voltar ao dashboard
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Saldo do mês
          </h1>
          <p className="text-sm text-muted">
            Todas as entradas e saídas que compõem o saldo do mês selecionado.
          </p>
        </div>
        <MonthNav pathname="/dashboard/saldo" year={year} month={month} />
      </div>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
```

- [ ] **Step 4: Remover o componente `ComingSoonDetail`, agora sem uso**

Run: `rm components/coming-soon-detail.tsx` (or delete the file via your editor).

Verify nothing else imports it:

Run: `grep -r "ComingSoonDetail" app/ components/ lib/`
Expected: no matches.

- [ ] **Step 5: Rodar toda a suíte de testes**

Run: `npm run test -- --run`
Expected: PASS — todos os testes existentes mais os 6 novos de `lib/dashboard.test.ts`.

- [ ] **Step 6: Rodar o lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/gastos/page.tsx app/dashboard/receitas/page.tsx app/dashboard/saldo/page.tsx
git rm components/coming-soon-detail.tsx
git commit -m "feat: show real monthly transactions on detail pages"
```
