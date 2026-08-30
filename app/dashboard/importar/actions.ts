"use server";

import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract-text";
import { parseNubank } from "@/lib/parsers/nubank";
import { getOrCreateNubankAccount } from "@/lib/accounts";
import type { ParsedTransaction } from "@/lib/parsers/types";

export async function importarExtrato(formData: FormData): Promise<
  | { importId: string; accountId: string; transactions: ParsedTransaction[] }
  | { error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Selecione um arquivo PDF." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada, faça login novamente." };

  let account: { id: string };
  try {
    account = await getOrCreateNubankAccount(supabase, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { error: `Falha ao obter conta Nubank: ${message}` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("extratos")
    .upload(path, buffer, { contentType: "application/pdf" });
  if (uploadError) return { error: `Falha no upload: ${uploadError.message}` };

  const text = await extractPdfText(buffer);
  const transactions = parseNubank(text);

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({ account_id: account.id, file_path: path, status: "pendente" })
    .select("id")
    .single();
  if (importError) return { error: `Falha ao registrar import: ${importError.message}` };

  return { importId: importRow.id, accountId: account.id, transactions };
}
