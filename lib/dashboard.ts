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
  ano?: string | string[];
  mes?: string | string[];
}): { year: number; month: number } {
  const now = new Date();
  const anoValue = Array.isArray(searchParams.ano) ? searchParams.ano[0] : searchParams.ano;
  const mesValue = Array.isArray(searchParams.mes) ? searchParams.mes[0] : searchParams.mes;
  const parsedYear = anoValue ? parseInt(anoValue, 10) : NaN;
  const parsedMonth = mesValue ? parseInt(mesValue, 10) : NaN;
  const year = Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : now.getFullYear();
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;
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

  type TransactionRow = {
    id: string;
    occurred_on: string;
    description: string;
    amount: number;
    direction: "entrada" | "saida";
    category_id: string | null;
    categories: { name: string } | { name: string }[] | null;
  };

  const rows = (data ?? []) as unknown as TransactionRow[];

  return rows.map((row) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    return {
      id: row.id,
      occurredOn: row.occurred_on,
      description: row.description,
      amount: row.amount,
      direction: row.direction,
      categoryId: row.category_id,
      categoryName: category?.name ?? null,
    };
  });
}

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
