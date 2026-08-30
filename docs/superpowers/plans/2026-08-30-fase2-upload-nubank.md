# Fase 2 — Upload de PDF + Parser Nubank + Revisão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário envie um PDF de fatura do Nubank, veja as transações extraídas automaticamente, corrija/complete o que for preciso numa tela de revisão, e salve tudo no banco — fechando o primeiro fluxo ponta a ponta com dados reais.

**Architecture:** Server Action recebe o PDF, extrai o texto (`pdf-parse`), roda o parser dedicado do Nubank (função pura, testável) que devolve uma lista de transações candidatas, e devolve isso ao cliente sem persistir nada ainda. O usuário revisa em uma tabela editável (Client Component) e confirma; só nesse momento uma segunda Server Action grava as linhas em `transactions`. Uma conta "Nubank (cartão)" é criada automaticamente na primeira importação — não há tela de gerenciamento de contas nesta fase.

**Tech Stack:** Next.js Server Actions, `pdf-parse` (extração de texto de PDF), Supabase Storage (arquivo original) + Postgres (`imports`, `accounts`, `categories`, `transactions` — já existem desde a Fase 1).

**Spec:** `docs/superpowers/specs/2026-08-30-controle-gastos-design.md`

## Global Constraints

- Categorização automática por regras de palavra-chave é **Fase 3** — nesta fase a categoria é escolhida manualmente na revisão (com opção de criar categoria nova ali mesmo).
- Nenhuma transação é persistida até o usuário confirmar na tela de revisão (spec, seção "Fluxo principal").
- Formato de data no banco: `date` (`YYYY-MM-DD`), conforme `supabase/migrations/0001_init.sql`.
- `transactions.direction` só aceita `'entrada'` ou `'saida'` (check constraint da migração 0001).

---

## Antes de começar: pré-requisito manual

O bucket de Storage precisa existir no projeto Supabase antes da Task 5 (upload). A Task 1 escreve a migração SQL; ela precisa ser colada manualmente no **SQL Editor** do Supabase (mesmo fluxo da Task 3 da Fase 1), já que a Fase 1 não configurou a CLI do Supabase para aplicar migrações automaticamente.

## File Structure

```
supabase/
  migrations/
    0002_storage_extratos.sql   # bucket "extratos" + políticas RLS
lib/
  pdf/
    extract-text.ts             # wrapper fino sobre pdf-parse
  parsers/
    types.ts                    # ParsedTransaction, Direction
    nubank.ts                   # parser puro do Nubank
    nubank.test.ts
    fixtures/
      nubank-sample.ts          # texto fictício com o formato real do Nubank
  accounts.ts                   # getOrCreateNubankAccount(supabase, userId)
  categories.ts                 # listCategories, createCategory (client-safe helpers)
app/
  dashboard/
    importar/
      page.tsx                  # formulário de upload
      actions.ts                # importarExtrato (parse) + confirmarImport (persist)
      review-table.tsx          # Client Component: tabela editável de revisão
components/
  sidebar.tsx                   # modificado: item "Importar extrato" habilitado
```

---

### Task 1: Bucket de Storage para os PDFs

**Files:**
- Create: `supabase/migrations/0002_storage_extratos.sql`

**Interfaces:**
- Produces: bucket privado `extratos` no Supabase Storage, com políticas RLS restringindo cada usuário à sua própria pasta (`{user_id}/...`).

- [ ] **Step 1: Escrever a migração**

```sql
-- 0002_storage_extratos.sql

insert into storage.buckets (id, name, public)
values ('extratos', 'extratos', false)
on conflict (id) do nothing;

create policy "owner_select_extratos" on storage.objects
  for select using (
    bucket_id = 'extratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert_extratos" on storage.objects
  for insert with check (
    bucket_id = 'extratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete_extratos" on storage.objects
  for delete using (
    bucket_id = 'extratos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 2: Aplicar no Supabase**

Cole o conteúdo no **SQL Editor** do painel do Supabase → **Run**. Confirme em **Storage** que o bucket `extratos` aparece, marcado como privado.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_storage_extratos.sql
git commit -m "feat: add extratos storage bucket with owner-scoped RLS"
```

---

### Task 2: Extração de texto de PDF

**Files:**
- Create: `lib/pdf/extract-text.ts`

**Interfaces:**
- Produces: `extractPdfText(buffer: Buffer): Promise<string>` — texto bruto de todas as páginas do PDF, concatenado com quebras de linha preservadas.

- [ ] **Step 1: Instalar a dependência**

```bash
npm install pdf-parse
npm install -D @types/pdf-parse
```

- [ ] **Step 2: Implementar o wrapper**

```ts
// lib/pdf/extract-text.ts
import pdf from "pdf-parse";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const result = await pdf(buffer);
  return result.text;
}
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros. `pdf-parse` roda em Node.js (não Edge) — esta função só pode ser chamada de Server Actions/Route Handlers, nunca do middleware/proxy.

Nota: não há teste automatizado para este arquivo — é um wrapper fino sobre uma biblioteca externa; a verificação real acontece de ponta a ponta na Task 5 (upload de um PDF de verdade).

- [ ] **Step 4: Commit**

```bash
git add lib/pdf/extract-text.ts package.json package-lock.json
git commit -m "feat: add PDF text extraction helper"
```

---

### Task 3: Parser do Nubank (TDD)

**Files:**
- Create: `lib/parsers/types.ts`
- Create: `lib/parsers/fixtures/nubank-sample.ts`
- Create: `lib/parsers/nubank.ts`
- Test: `lib/parsers/nubank.test.ts`

**Interfaces:**
- Produces: `parseNubank(text: string): ParsedTransaction[]`, onde
  ```ts
  type Direction = "entrada" | "saida";
  interface ParsedTransaction {
    date: string;        // "YYYY-MM-DD"
    description: string;
    amount: number;      // sempre positivo, em reais
    direction: Direction;
  }
  ```

Este é o parser mais importante do projeto — o formato abaixo foi extraído de uma fatura real do Nubank (com dados substituídos por valores fictícios, mas preservando as particularidades estruturais):
- Toda linha de transação começa com `DD MÊS` (ex: `21 JUL`), abreviação de 3 letras em maiúsculas.
- Pode vir seguida de `•••• NNNN` (4 últimos dígitos do cartão) — opcional, algumas linhas (IOF, pagamentos) não têm.
- A descrição e o valor `R$ X,XX` normalmente ficam na mesma linha.
- Transações internacionais quebram em várias linhas: a linha da data tem só a descrição, seguem 1-2 linhas de conversão de moeda, e o valor aparece sozinho numa linha própria depois.
- Pagamentos da fatura vêm com sinal de menos (`−R$ X,XX`) antes do valor — viram `direction: "entrada"`; todo o resto é `"saida"`.
- Linhas de subtotal (ex: nome do titular + valor total) não começam com `DD MÊS` — são ignoradas naturalmente pelo mesmo filtro, sem precisar de lógica extra.
- O ano não aparece nas linhas de transação — vem de "Data de vencimento: DD MÊS YYYY", que aparece uma vez no documento. Se o mês da transação for **maior** que o mês de vencimento, é do ano anterior (fatura fechando em janeiro com compra de dezembro).

- [ ] **Step 1: Criar os tipos**

```ts
// lib/parsers/types.ts
export type Direction = "entrada" | "saida";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  direction: Direction;
}
```

- [ ] **Step 2: Criar o fixture fictício**

```ts
// lib/parsers/fixtures/nubank-sample.ts
export const NUBANK_SAMPLE_TEXT = `
Olá, Fulano De Tal.
Esta é a sua fatura de
março, no valor de
R$ 512,40
Data de vencimento: 15 MAR 2026
Período vigente: 15 FEV a 15 MAR

TRANSAÇÕES DE 15 FEV A 15 MAR

Fulano De Tal R$ 812,40

15 FEV •••• 0001 Mercado Livre - Parcela 1/3 R$ 120,00
16 FEV •••• 0001 Padaria Bom Pão R$ 18,50
18 FEV IOF de "Loja Estrangeira Xyz" R$ 2,10
20 FEV •••• 0001 Loja Estrangeira Xyz
USD 10.00 = BRL 52.30
Conversão: BRL 5.23 = USD 1
R$ 52,30
25 FEV •••• 0002 Posto Ipiranga R$ 150,00
02 MAR •••• 0001 Supermercado Central R$ 245,00

Pagamentos e Financiamentos -R$ 300,00

15 FEV Pagamento em 15 FEV −R$ 300,00
28 FEV Saldo restante da fatura anterior R$ 0,00
`;
```

- [ ] **Step 3: Escrever os testes (RED)**

```ts
// lib/parsers/nubank.test.ts
import { describe, expect, it } from "vitest";
import { parseNubank } from "./nubank";
import { NUBANK_SAMPLE_TEXT } from "./fixtures/nubank-sample";

describe("parseNubank", () => {
  it("extrai uma transação simples de uma linha", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-16",
      description: "Padaria Bom Pão",
      amount: 18.5,
      direction: "saida",
    });
  });

  it("extrai uma linha sem os 4 dígitos do cartão (IOF)", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-18",
      description: 'IOF de "Loja Estrangeira Xyz"',
      amount: 2.1,
      direction: "saida",
    });
  });

  it("extrai uma transação internacional em múltiplas linhas", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-20",
      description: "Loja Estrangeira Xyz",
      amount: 52.3,
      direction: "saida",
    });
  });

  it("marca pagamento da fatura (valor negativo) como entrada", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-02-15",
      description: "Pagamento em 15 FEV",
      amount: 300,
      direction: "entrada",
    });
  });

  it("ignora a linha de subtotal do titular", () => {
    const result = parseNubank(NUBANK_SAMPLE_TEXT);
    expect(
      result.find((t) => t.description.includes("Fulano De Tal"))
    ).toBeUndefined();
  });

  it("aplica ano anterior quando o mês da transação é depois do mês de vencimento", () => {
    const text = `
Data de vencimento: 10 JAN 2027

29 DEZ •••• 0001 Compra de Fim de Ano R$ 99,90
`;
    const result = parseNubank(text);
    expect(result).toContainEqual({
      date: "2026-12-29",
      description: "Compra de Fim de Ano",
      amount: 99.9,
      direction: "saida",
    });
  });

  it("retorna array vazio para texto sem transações", () => {
    expect(parseNubank("nada aqui")).toEqual([]);
  });
});
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

Run: `npm run test -- lib/parsers/nubank.test.ts`
Expected: FAIL — `parseNubank` não existe ainda (erro de módulo não encontrado).

- [ ] **Step 5: Implementar o parser (GREEN)**

```ts
// lib/parsers/nubank.ts
import type { Direction, ParsedTransaction } from "./types";

const MONTHS: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).join("|");

const LINE_PATTERN = new RegExp(
  `^(\\d{2}) (${MONTH_NAMES})\\s*(?:••••\\s*\\d{4}\\s*)?(.*)$`
);
const AMOUNT_PATTERN = /([-−–]?)\s*R\$\s*([\d.,]+)\s*$/;
const STANDALONE_AMOUNT_PATTERN = /^([-−–]?)\s*R\$\s*([\d.,]+)\s*$/;
const DUE_DATE_PATTERN = new RegExp(
  `Data de vencimento:\\s*(\\d{2}) (${MONTH_NAMES}) (\\d{4})`
);

function parseAmount(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  return Math.abs(parseFloat(normalized));
}

function directionFromSign(sign: string): Direction {
  return sign ? "entrada" : "saida";
}

export function parseNubank(text: string): ParsedTransaction[] {
  const dueMatch = text.match(DUE_DATE_PATTERN);
  const dueMonth = dueMatch ? MONTHS[dueMatch[2]] : new Date().getMonth() + 1;
  const dueYear = dueMatch ? parseInt(dueMatch[3], 10) : new Date().getFullYear();

  const lines = text.split("\n").map((line) => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(LINE_PATTERN);
    if (!match) continue;

    const [, day, monthAbbr, rest] = match;
    const month = MONTHS[monthAbbr];
    const year = month > dueMonth ? dueYear - 1 : dueYear;
    const date = `${year}-${String(month).padStart(2, "0")}-${day}`;

    const inlineAmount = rest.match(AMOUNT_PATTERN);
    if (inlineAmount) {
      const description = rest.slice(0, inlineAmount.index).trim();
      if (!description) continue;
      transactions.push({
        date,
        description,
        amount: parseAmount(inlineAmount[2]),
        direction: directionFromSign(inlineAmount[1]),
      });
      continue;
    }

    const description = rest.trim();
    if (!description) continue;

    let amountLine: RegExpMatchArray | null = null;
    for (let j = i + 1; j < lines.length && j < i + 6; j++) {
      const candidate = lines[j].match(STANDALONE_AMOUNT_PATTERN);
      if (candidate) {
        amountLine = candidate;
        break;
      }
      if (lines[j].match(LINE_PATTERN)) break;
    }

    if (amountLine) {
      transactions.push({
        date,
        description,
        amount: parseAmount(amountLine[2]),
        direction: directionFromSign(amountLine[1]),
      });
    }
  }

  return transactions;
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npm run test -- lib/parsers/nubank.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 7: Commit**

```bash
git add lib/parsers
git commit -m "feat: add Nubank statement parser with TDD fixture"
```

---

### Task 4: Conta padrão do Nubank

**Files:**
- Create: `lib/accounts.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (server), `userId: string`.
- Produces: `getOrCreateNubankAccount(supabase, userId): Promise<{ id: string }>` — retorna a conta existente com `bank = 'nubank'` e `kind = 'cartao'` para o usuário, ou cria uma nova chamada "Nubank (cartão)".

- [ ] **Step 1: Implementar**

```ts
// lib/accounts.ts
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
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

Nota: sem teste automatizado — esta função é uma fina camada de acesso a dados sobre uma tabela real do Supabase; a verificação acontece de ponta a ponta na Task 5, contra o projeto Supabase real (que já tem a migração `0001_init.sql` aplicada desde a Fase 1).

- [ ] **Step 3: Commit**

```bash
git add lib/accounts.ts
git commit -m "feat: add get-or-create helper for the default Nubank account"
```

---

### Task 5: Upload + parsing (primeira Server Action)

**Files:**
- Create: `app/dashboard/importar/page.tsx`
- Create: `app/dashboard/importar/actions.ts`

**Interfaces:**
- Consumes: `extractPdfText` (Task 2), `parseNubank` (Task 3), `getOrCreateNubankAccount` (Task 4), `createClient` de `lib/supabase/server.ts`.
- Produces: Server Action `importarExtrato(formData: FormData)` retornando `{ importId: string; accountId: string; transactions: ParsedTransaction[] }` ou `{ error: string }`.

- [ ] **Step 1: Implementar a Server Action**

```ts
// app/dashboard/importar/actions.ts
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

  const account = await getOrCreateNubankAccount(supabase, user.id);

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
```

- [ ] **Step 2: Implementar a página de upload**

```tsx
// app/dashboard/importar/page.tsx
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
```

- [ ] **Step 3: Criar um placeholder mínimo de `review-table.tsx`**

A Task 7 substitui este arquivo pela versão completa — este placeholder existe só para o build passar entre tarefas.

```tsx
// app/dashboard/importar/review-table.tsx
"use client";

import type { ParsedTransaction } from "@/lib/parsers/types";

export function ReviewTable({
  initialTransactions,
}: {
  importId: string;
  accountId: string;
  initialTransactions: ParsedTransaction[];
}) {
  return <pre>{JSON.stringify(initialTransactions, null, 2)}</pre>;
}
```

- [ ] **Step 4: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Teste manual**

Run: `npm run dev`, faça login, acesse `/dashboard/importar`, envie o PDF real do Nubank.
Expected: a tela mostra o JSON das transações extraídas (revisão de verdade vem na Task 7). Confira no painel do Supabase: uma linha nova em `imports`, um arquivo novo no bucket `extratos`, e (se era a primeira importação) uma conta nova em `accounts` chamada "Nubank (cartão)".

Se a extração vier torta (texto do `pdf-parse` real difere do fixture fictício), ajuste os padrões do parser (Task 3) com base no que aparecer aqui — essa é a verificação real contra o formato de PDF de verdade que o texto fictício da Task 3 não substitui.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/importar
git commit -m "feat: add statement upload and parsing action"
```

---

### Task 6: Categorias (listar + criar)

**Files:**
- Create: `lib/categories.ts`

**Interfaces:**
- Produces: `listCategories(supabase): Promise<{id: string; name: string}[]>` e `createCategory(supabase, name: string): Promise<{id: string; name: string}>`, ambos client-safe (usam o cliente Supabase do browser, chamado a partir de um Client Component).

- [ ] **Step 1: Implementar**

```ts
// lib/categories.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Category {
  id: string;
  name: string;
}

export async function listCategories(
  supabase: SupabaseClient
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createCategory(
  supabase: SupabaseClient,
  name: string
): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/categories.ts
git commit -m "feat: add category list/create helpers"
```

---

### Task 7: Tela de revisão + confirmação (segunda Server Action)

**Files:**
- Modify: `app/dashboard/importar/review-table.tsx` (substitui o placeholder da Task 5)
- Create: `app/dashboard/importar/confirm-action.ts`

**Interfaces:**
- Consumes: `listCategories`/`createCategory` (Task 6), `createClient` de `lib/supabase/client.ts` (no componente) e `lib/supabase/server.ts` (na action).
- Produces: Server Action `confirmarImport(importId: string, accountId: string, rows: ReviewRow[]): Promise<{ error: string } | { success: true }>`, onde
  ```ts
  interface ReviewRow {
    date: string;
    description: string;
    amount: number;
    direction: "entrada" | "saida";
    categoryId: string | null;
  }
  ```

- [ ] **Step 1: Implementar a Server Action de confirmação**

```ts
// app/dashboard/importar/confirm-action.ts
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
```

- [ ] **Step 2: Implementar a tabela de revisão**

```tsx
// app/dashboard/importar/review-table.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { listCategories, createCategory, type Category } from "@/lib/categories";
import type { ParsedTransaction } from "@/lib/parsers/types";
import { confirmarImport } from "./confirm-action";

interface Row extends ParsedTransaction {
  categoryId: string | null;
}

export function ReviewTable({
  importId,
  accountId,
  initialTransactions,
}: {
  importId: string;
  accountId: string;
  initialTransactions: ParsedTransaction[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>(
    initialTransactions.map((t) => ({ ...t, categoryId: null }))
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCategories(supabase).then(setCategories).catch(() => {});
  }, [supabase]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        date: new Date().toISOString().slice(0, 10),
        description: "",
        amount: 0,
        direction: "saida",
        categoryId: null,
      },
    ]);
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    const category = await createCategory(supabase, newCategoryName.trim());
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCategoryName("");
  }

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const response = await confirmarImport(importId, accountId, rows);
    setSaving(false);
    if ("error" in response) {
      setError(response.error);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">
        Revisar transações
      </h1>
      <p className="text-sm text-muted">
        Confira, corrija ou remova linhas antes de salvar. Nada foi gravado
        ainda.
      </p>

      <div className="flex items-center gap-2">
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nova categoria"
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={handleCreateCategory}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
        >
          + Adicionar categoria
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-hover text-left text-muted">
            <tr>
              <th className="p-2">Data</th>
              <th className="p-2">Descrição</th>
              <th className="p-2">Valor</th>
              <th className="p-2">Direção</th>
              <th className="p-2">Categoria</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                <td className="p-2">
                  <input
                    type="date"
                    value={row.date}
                    onChange={(e) => updateRow(index, { date: e.target.value })}
                    className="w-36 rounded border border-border bg-background px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={row.description}
                    onChange={(e) =>
                      updateRow(index, { description: e.target.value })
                    }
                    className="w-64 rounded border border-border bg-background px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) =>
                      updateRow(index, { amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-24 rounded border border-border bg-background px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <select
                    value={row.direction}
                    onChange={(e) =>
                      updateRow(index, {
                        direction: e.target.value as "entrada" | "saida",
                      })
                    }
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="saida">Saída</option>
                    <option value="entrada">Entrada</option>
                  </select>
                </td>
                <td className="p-2">
                  <select
                    value={row.categoryId ?? ""}
                    onChange={(e) =>
                      updateRow(index, { categoryId: e.target.value || null })
                    }
                    className="rounded border border-border bg-background px-2 py-1"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-danger hover:underline"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
      >
        + Adicionar linha
      </button>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={saving || rows.length === 0}
        className="w-fit rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {saving ? "Salvando..." : `Salvar ${rows.length} transações`}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 4: Teste manual completo**

Run: `npm run dev`. Faça login → `/dashboard/importar` → envie o PDF do Nubank → confira a tabela de revisão → crie uma categoria nova → atribua categorias a algumas linhas → remova uma linha indevida → clique em "Salvar".
Expected: redireciona para `/dashboard`; no painel do Supabase, a tabela `transactions` tem as linhas salvas com `category_id` preenchido onde escolhido, e `imports.status` da importação virou `revisado`.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/importar
git commit -m "feat: add transaction review screen and confirm action"
```

---

### Task 8: Ponto de entrada na navegação

**Files:**
- Modify: `components/sidebar.tsx`

**Interfaces:**
- Consumes: nada novo — só reordena/habilita um item já existente na constante `NAV_ITEMS`.

- [ ] **Step 1: Habilitar o link de importação**

Em `components/sidebar.tsx`, adicione um item habilitado antes de "Transações" (que continua desabilitada — a lista/navegação de transações propriamente dita ainda não existe, isso é trabalho de uma fase futura):

```ts
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Importar extrato", href: "/dashboard/importar", enabled: true },
  { label: "Transações", href: "#", enabled: false },
  { label: "Categorias", href: "#", enabled: false },
  { label: "Orçamento", href: "#", enabled: false },
] as const;
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Teste manual**

`npm run dev`, confirme que "Importar extrato" aparece habilitado na sidebar e leva para `/dashboard/importar`.

- [ ] **Step 4: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: enable Importar extrato nav item"
```

---

## Fora de escopo desta fase (fica para depois)

- Cards do dashboard (Saldo/Receitas/Gastos) continuam mostrando "Sem dados ainda" — não são conectados aos dados reais nesta fase; isso é trabalho da Fase 4 (orçamento + dashboard).
- Tela de listagem/gerenciamento de transações já salvas (o item "Transações" da sidebar continua "Em breve").
- Categorização automática por regras de palavra-chave — Fase 3.
- Parsers de Sicoob Credivar, Banco do Brasil e Mercado Pago — Fase 3.
