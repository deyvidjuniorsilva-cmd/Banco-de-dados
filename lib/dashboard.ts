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
