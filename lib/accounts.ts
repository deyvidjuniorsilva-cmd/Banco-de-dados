import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOrCreateNubankAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string }> {
  const { data: existing, error: selectError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner", userId)
    .eq("bank", "nubank")
    .eq("kind", "cartao")
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("accounts")
    .insert({ name: "Nubank (cartão)", bank: "nubank", kind: "cartao" })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return created;
}
