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

export async function deleteBudget(supabase: SupabaseClient, budgetId: string): Promise<void> {
  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
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
