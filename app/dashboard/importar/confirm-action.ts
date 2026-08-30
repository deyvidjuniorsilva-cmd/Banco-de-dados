"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ReviewRow {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saida";
  categoryId: string | null;
}

export async function confirmarImport(
  importId: string,
  accountId: string,
  rows: ReviewRow[]
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada, faça login novamente." };

  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("owner", user.id)
    .maybeSingle();
  if (accountError) return { error: `Falha ao verificar conta: ${accountError.message}` };
  if (!accountRow) return { error: "Conta não encontrada ou não pertence a este usuário." };

  const { data: importRow, error: importCheckError } = await supabase
    .from("imports")
    .select("id")
    .eq("id", importId)
    .eq("owner", user.id)
    .maybeSingle();
  if (importCheckError) return { error: `Falha ao verificar importação: ${importCheckError.message}` };
  if (!importRow) return { error: "Importação não encontrada ou não pertence a este usuário." };

  const { error: insertError } = await supabase.from("transactions").insert(
    rows.map((row) => ({
      account_id: accountId,
      import_id: importId,
      occurred_on: row.date,
      description: row.description,
      amount: row.amount,
      direction: row.direction,
      category_id: row.categoryId,
    }))
  );
  if (insertError) return { error: `Falha ao salvar: ${insertError.message}` };

  const { error: updateError } = await supabase
    .from("imports")
    .update({ status: "revisado" })
    .eq("id", importId);
  if (updateError) return { error: `Falha ao atualizar status: ${updateError.message}` };

  revalidatePath("/dashboard");
  return { success: true };
}
