"use client";

import { useState } from "react";
import { importarExtrato } from "./actions";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { ReviewTable } from "./review-table";
import { errorMessage } from "@/lib/errors";

export default function ImportarPage() {
  const [result, setResult] = useState<{
    importId: string;
    accountId: string;
    transactions: ParsedTransaction[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const response = await importarExtrato(formData);
      if ("error" in response) {
        setError(response.error);
        return;
      }
      setResult(response);
    } catch (err) {
      setError(`Falha inesperada: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <ReviewTable
        importId={result.importId}
        accountId={result.accountId}
        initialTransactions={result.transactions}
        onCancel={() => setResult(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">
        Importar extrato
      </h1>
      <p className="text-sm text-muted">
        Envie a fatura em PDF do Nubank para extrair as transações
        automaticamente.
      </p>
      <form action={handleSubmit} className="flex flex-col gap-3">
        <select
          name="bank"
          required
          className="rounded-lg border border-border bg-surface p-2 text-sm text-foreground"
        >
          <option value="">Selecione o banco</option>
          <option value="nubank">Nubank (fatura de cartão)</option>
          <option value="sicoob_credivar">Sicoob Credivar (extrato de conta)</option>
        </select>
        <input
          type="file"
          name="file"
          accept="application/pdf"
          required
          className="rounded-lg border border-border bg-surface p-2 text-sm text-foreground"
        />
        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {loading ? "Processando..." : "Enviar"}
        </button>
      </form>
    </div>
  );
}
