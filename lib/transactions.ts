import type { SupabaseClient } from "@supabase/supabase-js";
import { findPossibleDuplicate, type DedupCandidate } from "./duplicates";
import type { ParsedTransaction } from "./parsers/types";

export async function listTransactionsForAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<DedupCandidate[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_on, amount")
    .eq("account_id", accountId);
  if (error) throw error;
  return data.map((row) => ({ occurredOn: row.occurred_on, amount: row.amount }));
}

export interface DuplicateCheckedRow extends ParsedTransaction {
  possibleDuplicate: boolean;
  included: boolean;
}

export function markDuplicateRows(
  rows: ParsedTransaction[],
  existing: DedupCandidate[]
): DuplicateCheckedRow[] {
  return rows.map((row) => {
    const possibleDuplicate = findPossibleDuplicate(row, existing);
    return { ...row, possibleDuplicate, included: !possibleDuplicate };
  });
}

export async function updateTransactionCategory(
  supabase: SupabaseClient,
  id: string,
  categoryId: string | null
): Promise<void> {
  const { error } = await supabase
    .from("transactions")
    .update({ category_id: categoryId })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
