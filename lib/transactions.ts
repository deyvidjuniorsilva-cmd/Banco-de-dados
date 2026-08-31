import type { SupabaseClient } from "@supabase/supabase-js";

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
