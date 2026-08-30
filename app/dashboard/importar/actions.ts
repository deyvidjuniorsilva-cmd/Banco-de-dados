"use server";

import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract-text";
import { parseNubank } from "@/lib/parsers/nubank";
import { parseSicoob } from "@/lib/parsers/sicoob";
import { getOrCreateAccount } from "@/lib/accounts";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { errorMessage } from "@/lib/errors";

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

  const bankValue = formData.get("bank");
  if (bankValue !== "nubank" && bankValue !== "sicoob_credivar") {
    return { error: "Selecione o banco de origem do extrato." };
  }
  const bank = bankValue;

  let account: { id: string };
  try {
    account = await getOrCreateAccount(supabase, user.id, bank);
  } catch (err) {
    return { error: `Falha ao obter conta Nubank: ${errorMessage(err)}` };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("extratos")
    .upload(path, buffer, { contentType: "application/pdf" });
  if (uploadError) return { error: `Falha no upload: ${uploadError.message}` };

  let transactions: ParsedTransaction[];
  try {
    const text = await extractPdfText(buffer);
    transactions = bank === "nubank" ? parseNubank(text) : parseSicoob(text);
  } catch (parseError) {
    return {
      error: `Não foi possível extrair as transações: ${errorMessage(parseError)}`,
    };
  }

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .insert({ account_id: account.id, file_path: path, status: "pendente" })
    .select("id")
    .single();
  if (importError) return { error: `Falha ao registrar import: ${importError.message}` };

  return { importId: importRow.id, accountId: account.id, transactions };
}
