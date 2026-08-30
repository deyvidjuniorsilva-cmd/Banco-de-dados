"use client";

import { useState } from "react";
import { importarExtrato } from "./actions";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { ReviewTable } from "./review-table";

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
    const response = await importarExtrato(formData);
    setLoading(false);
    if ("error" in response) {
      setError(response.error);
      return;
    }
    setResult(response);
  }

  if (result) {
    return (
      <ReviewTable
        importId={result.importId}
        accountId={result.accountId}
        initialTransactions={result.transactions}
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
