import type { SupabaseClient } from "@supabase/supabase-js";

type SupportedBank = "nubank" | "sicoob_credivar";

const ACCOUNT_DEFAULTS: Record<
  SupportedBank,
  { name: string; kind: "conta" | "cartao" }
> = {
  nubank: { name: "Nubank (cartão)", kind: "cartao" },
  sicoob_credivar: { name: "Sicoob Credivar (conta)", kind: "conta" },
};

export async function getOrCreateAccount(
  supabase: SupabaseClient,
  userId: string,
  bank: SupportedBank
): Promise<{ id: string }> {
  const { name, kind } = ACCOUNT_DEFAULTS[bank];

  const { data: existing, error: selectError } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner", userId)
    .eq("bank", bank)
    .eq("kind", kind)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("accounts")
    .insert({ name, bank, kind })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return created;
}
