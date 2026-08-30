# Fase 3 — Categorização Automática + Parser Sicoob Credivar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar categorização automática por regras de palavra-chave (com tela de gerenciamento) e um segundo parser de banco (Sicoob Credivar), com seletor de banco na tela de upload.

**Architecture:** `category_rules` (já existe desde a Fase 1) guarda pares palavra-chave → categoria, ordenados por `position`. Uma função pura (`matchCategory`) percorre as regras na ordem e devolve a primeira categoria cuja palavra-chave aparece na descrição. A tela de revisão (Fase 2) passa a pré-preencher a categoria de cada transação chamando essa função no cliente, continuando totalmente editável. O parser do Sicoob segue o mesmo padrão do Nubank (função pura, testável, baseada no texto real extraído do PDF) — a tela de upload ganha um seletor de banco que escolhe qual parser rodar.

**Tech Stack:** Mesma stack das fases anteriores (Next.js Server Actions + Client Components, Supabase). Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-30-controle-gastos-design.md`

## Global Constraints

- Regras aplicadas na ordem de `position`; a primeira que bater na descrição define a categoria (spec, seção "Categorização").
- Sempre editável na tela de revisão, mesmo com sugestão automática (spec).
- `direction` só aceita `'entrada'` ou `'saida'` (check constraint de `supabase/migrations/0001_init.sql`).
- `accounts.bank` aceita `'nubank' | 'sicoob_credivar' | 'banco_do_brasil' | 'mercado_pago'`; `accounts.kind` aceita `'conta' | 'cartao'` — Sicoob Credivar é conta corrente (`kind: 'conta'`), diferente do Nubank que é cartão.

---

## File Structure

```
lib/
  parsers/
    sicoob.ts                    # parser puro do Sicoob Credivar
    sicoob.test.ts
    fixtures/
      sicoob-sample.ts           # texto fictício com o formato real do Sicoob
  categorization.ts              # matchCategory (função pura)
  categorization.test.ts
  category-rules.ts              # listCategoryRules, createCategoryRule, deleteCategoryRule, swapCategoryRulePositions
  accounts.ts                    # modificado: getOrCreateAccount(supabase, userId, bank) genérico
app/
  dashboard/
    categorias/
      page.tsx                   # tela de gerenciar categorias + regras
    importar/
      page.tsx                   # modificado: seletor de banco
      actions.ts                 # modificado: despacha pro parser certo conforme o banco
      review-table.tsx           # modificado: pré-preenche categoria via matchCategory
components/
  sidebar.tsx                    # modificado: item "Categorias" habilitado
```

---

### Task 1: Parser do Sicoob Credivar (TDD)

**Files:**
- Create: `lib/parsers/fixtures/sicoob-sample.ts`
- Create: `lib/parsers/sicoob.ts`
- Test: `lib/parsers/sicoob.test.ts`

**Interfaces:**
- Consumes: `Direction`, `ParsedTransaction` de `./types` (já existem da Fase 2).
- Produces: `parseSicoob(text: string): ParsedTransaction[]`, mesma interface do `parseNubank`.

O formato foi extraído de um extrato real do Sicoob Credivar (com dados substituídos por valores fictícios):
- Toda linha de transação começa com `DD/MM` (sem ano), seguida da descrição e do valor terminando em `C` (crédito → `entrada`) ou `D` (débito → `saida`), sem espaço entre o valor e a letra (ex: `2.700,00C`).
- Linhas de saldo (`SALDO ANTERIOR`, `SALDO DO DIA`, `SALDO BLOQ.ANTERIOR`) têm a mesma estrutura `DD/MM DESCRIÇÃO VALOR` mas **não são transações reais** — precisam ser filtradas pelo texto da descrição.
- Cada transação pode ter 1-4 linhas de detalhe depois (nome do favorecido, CPF mascarado, `DOC.: ...`) que não começam com `DD/MM` — são ignoradas naturalmente pelo mesmo filtro usado no parser do Nubank.
- O ano não aparece nas linhas de transação — vem da linha `PERÍODO: DD/MM/AAAA - DD/MM/AAAA`, que sempre aparece uma vez no documento. Mesma lógica de virada de ano do parser do Nubank: se o mês da transação for maior que o mês final do período, é do ano anterior.

- [ ] **Step 1: Criar o fixture fictício**

```ts
// lib/parsers/fixtures/sicoob-sample.ts
export const SICOOB_SAMPLE_TEXT = `
SICOOB
SISTEMA DE COOPERATIVAS DE CRÉDITO DO BRASIL
30/08/2026 EXTRATO CONTA CORRENTE 17:38:14
COOP.: 1234-5 / SICOOB EXEMPLO
CONTA: 11.111-1 / FULANO DE TAL
PERÍODO: 01/07/2026 - 31/07/2026
HISTÓRICO DE MOVIMENTAÇÃO
DATA HISTÓRICO VALOR
29/06 SALDO ANTERIOR 0,00C
01/07 PIX REC.OUTRA IF MT 1.000,00C
Recebimento Pix
Fulano De Tal
***.000.000-**
DOC.: Pix
01/07 SALDO DO DIA 1.000,00C
05/07 COMP MASTER MAESTRO 25,50D
Mercado Central SAO PAULO BRA
DOC.: 123456
05/07 SALDO DO DIA 974,50C
10/07 DÉB.CONV.TELECOMUN. 80,00D
DOC.: OPERADORA TELECOM
10/07 SALDO DO DIA 894,50C
15/07 TRANSF. PIX SICOOB 200,00D
FAV.: CICLANO DA SILVA
Transferência Pix
FULANO DE TAL
***.000.000-**
DOC.: 12345678
15/07 SALDO DO DIA 694,50C
`;
```

- [ ] **Step 2: Escrever os testes (RED)**

```ts
// lib/parsers/sicoob.test.ts
import { describe, expect, it } from "vitest";
import { parseSicoob } from "./sicoob";
import { SICOOB_SAMPLE_TEXT } from "./fixtures/sicoob-sample";

describe("parseSicoob", () => {
  it("extrai uma transação de crédito (entrada)", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-07-01",
      description: "PIX REC.OUTRA IF MT",
      amount: 1000,
      direction: "entrada",
    });
  });

  it("extrai uma transação de débito (saida)", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-07-05",
      description: "COMP MASTER MAESTRO",
      amount: 25.5,
      direction: "saida",
    });
  });

  it("extrai transferência Pix corretamente", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result).toContainEqual({
      date: "2026-07-15",
      description: "TRANSF. PIX SICOOB",
      amount: 200,
      direction: "saida",
    });
  });

  it("ignora linhas de SALDO ANTERIOR e SALDO DO DIA", () => {
    const result = parseSicoob(SICOOB_SAMPLE_TEXT);
    expect(result.find((t) => t.description.includes("SALDO"))).toBeUndefined();
    expect(result).toHaveLength(4);
  });

  it("aplica ano anterior quando o mês da transação é depois do mês final do período", () => {
    const text = `
PERÍODO: 15/12/2026 - 15/01/2027

28/12 COMP MASTER MAESTRO 50,00D
`;
    const result = parseSicoob(text);
    expect(result).toContainEqual({
      date: "2026-12-28",
      description: "COMP MASTER MAESTRO",
      amount: 50,
      direction: "saida",
    });
  });

  it("lança erro quando o período não é encontrado", () => {
    expect(() => parseSicoob("nada aqui")).toThrow();
  });

  it("retorna array vazio para um período válido sem transações", () => {
    expect(
      parseSicoob("PERÍODO: 01/07/2026 - 31/07/2026\nnada mais aqui")
    ).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npm run test -- lib/parsers/sicoob.test.ts`
Expected: FAIL — `parseSicoob` não existe ainda.

- [ ] **Step 4: Implementar o parser (GREEN)**

```ts
// lib/parsers/sicoob.ts
import type { Direction, ParsedTransaction } from "./types";

const LINE_PATTERN = /^(\d{2})\/(\d{2})\s+(.+?)\s+([\d.]+,\d{2})([CD])$/;
const PERIODO_PATTERN =
  /PERÍODO:\s*\d{2}\/\d{2}\/\d{4}\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/;
const IGNORED_DESCRIPTIONS = [
  "SALDO ANTERIOR",
  "SALDO DO DIA",
  "SALDO BLOQ.ANTERIOR",
];

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

function directionFromSuffix(suffix: string): Direction {
  return suffix === "C" ? "entrada" : "saida";
}

export function parseSicoob(text: string): ParsedTransaction[] {
  const periodoMatch = text.match(PERIODO_PATTERN);
  if (!periodoMatch) {
    throw new Error("Não foi possível encontrar o período do extrato no PDF.");
  }
  const refMonth = parseInt(periodoMatch[2], 10);
  const refYear = parseInt(periodoMatch[3], 10);

  const lines = text.split("\n").map((line) => line.trim());
  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const match = line.match(LINE_PATTERN);
    if (!match) continue;

    const [, day, month, description, amountRaw, suffix] = match;
    const trimmedDescription = description.trim();
    if (IGNORED_DESCRIPTIONS.includes(trimmedDescription.toUpperCase())) {
      continue;
    }

    const monthNum = parseInt(month, 10);
    const year = monthNum > refMonth ? refYear - 1 : refYear;

    transactions.push({
      date: `${year}-${month}-${day}`,
      description: trimmedDescription,
      amount: parseAmount(amountRaw),
      direction: directionFromSuffix(suffix),
    });
  }

  return transactions;
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npm run test -- lib/parsers/sicoob.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Commit**

```bash
git add lib/parsers/sicoob.ts lib/parsers/sicoob.test.ts lib/parsers/fixtures/sicoob-sample.ts
git commit -m "feat: add Sicoob Credivar statement parser with TDD fixture"
```

---

### Task 2: Motor de categorização (TDD)

**Files:**
- Create: `lib/categorization.ts`
- Test: `lib/categorization.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MatchableRule {
    keyword: string;
    categoryId: string;
  }
  export function matchCategory(description: string, rules: MatchableRule[]): string | null
  ```
  As regras devem chegar **já ordenadas por prioridade** (quem chama é responsável por ordenar por `position` na consulta ao banco) — a função só percorre a lista na ordem recebida.

- [ ] **Step 1: Escrever os testes (RED)**

```ts
// lib/categorization.test.ts
import { describe, expect, it } from "vitest";
import { matchCategory } from "./categorization";

describe("matchCategory", () => {
  it("retorna a categoria da primeira regra cuja palavra-chave aparece na descrição", () => {
    const rules = [
      { keyword: "uber", categoryId: "cat-transporte" },
      { keyword: "mercado", categoryId: "cat-mercado" },
    ];
    expect(matchCategory("UBER *TRIP", rules)).toBe("cat-transporte");
  });

  it("não diferencia maiúsculas de minúsculas", () => {
    const rules = [{ keyword: "MERCADO", categoryId: "cat-mercado" }];
    expect(matchCategory("mercado livre - parcela 1/3", rules)).toBe(
      "cat-mercado"
    );
  });

  it("usa a primeira regra que bater, respeitando a ordem da lista", () => {
    const rules = [
      { keyword: "pix", categoryId: "cat-transferencia" },
      { keyword: "uber", categoryId: "cat-transporte" },
    ];
    expect(matchCategory("PIX UBER TRIP", rules)).toBe("cat-transferencia");
  });

  it("retorna null quando nenhuma regra bate", () => {
    const rules = [{ keyword: "uber", categoryId: "cat-transporte" }];
    expect(matchCategory("padaria bom pao", rules)).toBeNull();
  });

  it("retorna null quando não há regras", () => {
    expect(matchCategory("qualquer coisa", [])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm run test -- lib/categorization.test.ts`
Expected: FAIL — `matchCategory` não existe ainda.

- [ ] **Step 3: Implementar (GREEN)**

```ts
// lib/categorization.ts
export interface MatchableRule {
  keyword: string;
  categoryId: string;
}

export function matchCategory(
  description: string,
  rules: MatchableRule[]
): string | null {
  const normalizedDescription = description.toLowerCase();
  for (const rule of rules) {
    if (normalizedDescription.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId;
    }
  }
  return null;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm run test -- lib/categorization.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/categorization.ts lib/categorization.test.ts
git commit -m "feat: add keyword-based category matching engine"
```

---

### Task 3: Acesso a dados de regras de categoria

**Files:**
- Create: `lib/category-rules.ts`

**Interfaces:**
- Consumes: `SupabaseClient` do browser (mesmo padrão de `lib/categories.ts`).
- Produces:
  ```ts
  export interface CategoryRule {
    id: string;
    keyword: string;
    categoryId: string;
    position: number;
  }
  export function listCategoryRules(supabase): Promise<CategoryRule[]>  // ordenado por position
  export function createCategoryRule(supabase, keyword: string, categoryId: string): Promise<CategoryRule>
  export function deleteCategoryRule(supabase, id: string): Promise<void>
  export function swapCategoryRulePositions(supabase, ruleA: CategoryRule, ruleB: CategoryRule): Promise<void>
  ```

- [ ] **Step 1: Implementar**

```ts
// lib/category-rules.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CategoryRule {
  id: string;
  keyword: string;
  categoryId: string;
  position: number;
}

function fromRow(row: {
  id: string;
  keyword: string;
  category_id: string;
  position: number;
}): CategoryRule {
  return {
    id: row.id,
    keyword: row.keyword,
    categoryId: row.category_id,
    position: row.position,
  };
}

export async function listCategoryRules(
  supabase: SupabaseClient
): Promise<CategoryRule[]> {
  const { data, error } = await supabase
    .from("category_rules")
    .select("id, keyword, category_id, position")
    .order("position");
  if (error) throw error;
  return data.map(fromRow);
}

export async function createCategoryRule(
  supabase: SupabaseClient,
  keyword: string,
  categoryId: string
): Promise<CategoryRule> {
  const { data: existing, error: maxError } = await supabase
    .from("category_rules")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  if (maxError) throw maxError;
  const nextPosition = existing.length > 0 ? existing[0].position + 1 : 0;

  const { data, error } = await supabase
    .from("category_rules")
    .insert({ keyword, category_id: categoryId, position: nextPosition })
    .select("id, keyword, category_id, position")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteCategoryRule(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("category_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function swapCategoryRulePositions(
  supabase: SupabaseClient,
  ruleA: CategoryRule,
  ruleB: CategoryRule
): Promise<void> {
  const { error: errorA } = await supabase
    .from("category_rules")
    .update({ position: ruleB.position })
    .eq("id", ruleA.id);
  if (errorA) throw errorA;

  const { error: errorB } = await supabase
    .from("category_rules")
    .update({ position: ruleA.position })
    .eq("id", ruleB.id);
  if (errorB) throw errorB;
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

Nota: sem teste automatizado — esta é uma camada fina de acesso a dados sobre uma tabela real do Supabase, mesmo padrão de `lib/categories.ts` da Fase 2; verificação real acontece de ponta a ponta na Task 4.

- [ ] **Step 3: Commit**

```bash
git add lib/category-rules.ts
git commit -m "feat: add category rule data access helpers"
```

---

### Task 4: Tela de gerenciar categorias e regras

**Files:**
- Create: `app/dashboard/categorias/page.tsx`

**Interfaces:**
- Consumes: `listCategories`/`createCategory` de `lib/categories.ts` (Fase 2), `listCategoryRules`/`createCategoryRule`/`deleteCategoryRule`/`swapCategoryRulePositions` de `lib/category-rules.ts` (Task 3), `createClient` de `lib/supabase/client.ts`, `Card` de `components/card.tsx`, `errorMessage` de `lib/errors.ts` (Fase 2).

- [ ] **Step 1: Implementar a página**

```tsx
// app/dashboard/categorias/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listCategories, createCategory, type Category } from "@/lib/categories";
import {
  listCategoryRules,
  createCategoryRule,
  deleteCategoryRule,
  swapCategoryRulePositions,
  type CategoryRule,
} from "@/lib/category-rules";
import { errorMessage } from "@/lib/errors";
import { Card } from "@/components/card";

export default function CategoriasPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const [categoryList, ruleList] = await Promise.all([
        listCategories(supabase),
        listCategoryRules(supabase),
      ]);
      setCategories(categoryList);
      setRules(ruleList);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(supabase, newCategoryName.trim());
      setNewCategoryName("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleCreateRule() {
    if (!newKeyword.trim() || !newRuleCategoryId) return;
    try {
      await createCategoryRule(supabase, newKeyword.trim(), newRuleCategoryId);
      setNewKeyword("");
      setNewRuleCategoryId("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await deleteCategoryRule(supabase, id);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleMoveRule(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;
    try {
      await swapCategoryRulePositions(supabase, rules[index], rules[targetIndex]);
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function categoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "—";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Categorias</h1>
        <p className="text-sm text-muted">
          Gerencie suas categorias e as regras que categorizam transações
          automaticamente na revisão de importação.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-foreground">Categorias</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full bg-surface-hover px-3 py-1 text-sm text-foreground"
            >
              {category.name}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nova categoria"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={handleCreateCategory}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
          >
            + Adicionar categoria
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground">
          Regras de categorização
        </h2>
        <p className="mt-1 text-xs text-muted">
          A primeira regra cuja palavra-chave aparecer na descrição da
          transação define a categoria sugerida. Ordem importa.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-foreground">
                  &quot;{rule.keyword}&quot;
                </span>
                <span className="text-muted">→</span>
                <span className="text-foreground">
                  {categoryName(rule.categoryId)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleMoveRule(index, "up")}
                  disabled={index === 0}
                  className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-hover disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveRule(index, "down")}
                  disabled={index === rules.length - 1}
                  className="rounded px-2 py-1 text-sm text-muted hover:bg-surface-hover disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  className="rounded px-2 py-1 text-sm text-danger hover:bg-danger-soft"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted">Nenhuma regra cadastrada ainda.</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Palavra-chave (ex: uber)"
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <select
            value={newRuleCategoryId}
            onChange={(e) => setNewRuleCategoryId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateRule}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:bg-brand-hover"
          >
            + Adicionar regra
          </button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Teste manual**

Run: `npm run dev`, faça login, acesse `/dashboard/categorias` (link ainda não está na sidebar — acesse pela URL diretamente por enquanto, a Task 7 habilita o link). Crie uma categoria, crie uma regra, reordene com as setas, remova uma regra.
Expected: tudo funciona e reflete no banco (confira em Table Editor do Supabase se necessário).

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/categorias
git commit -m "feat: add categories and category rules management page"
```

---

### Task 5: Conta genérica por banco

**Files:**
- Modify: `lib/accounts.ts`

**Interfaces:**
- Produces: `getOrCreateAccount(supabase, userId: string, bank: "nubank" | "sicoob_credivar"): Promise<{id: string}>` — substitui `getOrCreateNubankAccount`.

- [ ] **Step 1: Reescrever o helper**

```ts
// lib/accounts.ts
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
```

- [ ] **Step 2: Atualizar o único ponto de uso (mantendo o build verde)**

Em `app/dashboard/importar/actions.ts`, troque a importação e a chamada. Use `"nubank"` fixo por enquanto — a Task 6 troca isso pela leitura real do banco escolhido no formulário, mantendo o build passando em cada task:

```ts
// antes
import { getOrCreateNubankAccount } from "@/lib/accounts";
// ...
account = await getOrCreateNubankAccount(supabase, user.id);

// depois
import { getOrCreateAccount } from "@/lib/accounts";
// ...
account = await getOrCreateAccount(supabase, user.id, "nubank");
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros (comportamento idêntico ao anterior, já que "nubank" é o único banco suportado até a Task 6).

- [ ] **Step 4: Commit**

```bash
git add lib/accounts.ts app/dashboard/importar/actions.ts
git commit -m "feat: generalize account helper to support multiple banks"
```

---

### Task 6: Seletor de banco na tela de upload + categorização automática na revisão

**Files:**
- Modify: `app/dashboard/importar/page.tsx`
- Modify: `app/dashboard/importar/actions.ts`
- Modify: `app/dashboard/importar/review-table.tsx`

**Interfaces:**
- Consumes: `parseSicoob` de `lib/parsers/sicoob.ts` (Task 1), `matchCategory` de `lib/categorization.ts` (Task 2), `listCategoryRules` de `lib/category-rules.ts` (Task 3), `getOrCreateAccount` de `lib/accounts.ts` (Task 5).

- [ ] **Step 1: Adicionar o seletor de banco na página de upload**

Em `app/dashboard/importar/page.tsx`, adicione um `<select name="bank">` antes do input de arquivo:

```tsx
<select
  name="bank"
  required
  className="rounded-lg border border-border bg-surface p-2 text-sm text-foreground"
>
  <option value="">Selecione o banco</option>
  <option value="nubank">Nubank (fatura de cartão)</option>
  <option value="sicoob_credivar">Sicoob Credivar (extrato de conta)</option>
</select>
```

Coloque esse `<select>` logo antes do `<input type="file" ...>` existente, dentro do mesmo `<form>`.

- [ ] **Step 2: Despachar pro parser certo em `actions.ts`**

```ts
// app/dashboard/importar/actions.ts
import { parseSicoob } from "@/lib/parsers/sicoob";
// (mantém os imports existentes: parseNubank, extractPdfText, etc.)

// dentro de importarExtrato, antes de resolver a conta:
const bankValue = formData.get("bank");
if (bankValue !== "nubank" && bankValue !== "sicoob_credivar") {
  return { error: "Selecione o banco de origem do extrato." };
}
const bank = bankValue;

// troca o "nubank" fixo (da Task 5) pela variável `bank` de verdade:
account = await getOrCreateAccount(supabase, user.id, bank);

// no bloco try/catch de extração, troca o parser conforme o banco:
try {
  const text = await extractPdfText(buffer);
  transactions = bank === "nubank" ? parseNubank(text) : parseSicoob(text);
} catch (parseError) {
  return {
    error: `Não foi possível extrair as transações: ${errorMessage(parseError)}`,
  };
}
```

- [ ] **Step 3: Pré-preencher categoria na tela de revisão**

Em `app/dashboard/importar/review-table.tsx`, some a busca de regras e o cálculo da categoria inicial de cada linha:

```ts
import { listCategoryRules } from "@/lib/category-rules";
import { matchCategory } from "@/lib/categorization";

// dentro do componente, troque o useEffect que só busca categorias:
useEffect(() => {
  async function loadCategorizationData() {
    try {
      const [categoryList, ruleList] = await Promise.all([
        listCategories(supabase),
        listCategoryRules(supabase),
      ]);
      setCategories(categoryList);
      setRows((prev) =>
        prev.map((row) =>
          row.categoryId
            ? row
            : {
                ...row,
                categoryId: matchCategory(row.description, ruleList),
              }
        )
      );
    } catch (err) {
      setError(`Falha ao carregar categorias: ${errorMessage(err)}`);
    }
  }
  loadCategorizationData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Isso substitui o `useEffect` existente que só chamava `listCategories` — mantenha só uma versão (a nova, que faz as duas buscas).

- [ ] **Step 4: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Teste manual completo**

Run: `npm run dev`. Crie pelo menos uma regra em `/dashboard/categorias` (ex: palavra-chave que apareça em alguma transação do seu extrato). Vá em `/dashboard/importar`, escolha o banco, envie o PDF correspondente.
Expected: transações cuja descrição bate com alguma regra já vêm com a categoria pré-selecionada na tela de revisão; as demais continuam "Sem categoria"; tudo continua editável.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/importar
git commit -m "feat: add bank selector and automatic category suggestions on review"
```

---

### Task 7: Ponto de entrada na navegação

**Files:**
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Habilitar o item "Categorias"**

```ts
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Importar extrato", href: "/dashboard/importar", enabled: true },
  { label: "Transações", href: "#", enabled: false },
  { label: "Categorias", href: "/dashboard/categorias", enabled: true },
  { label: "Orçamento", href: "#", enabled: false },
] as const;
```

- [ ] **Step 2: Verificar o build**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Teste manual**

`npm run dev`, confirme que "Categorias" aparece habilitado na sidebar e leva para `/dashboard/categorias`.

- [ ] **Step 4: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: enable Categorias nav item"
```

---

## Fora de escopo desta fase (fica para depois)

- Parsers de Banco do Brasil e Mercado Pago — aguardando PDFs de exemplo reais.
- Tela de listagem/gerenciamento de transações já salvas.
- Edição de regra existente (só criar/remover/reordenar por enquanto — editar exige apagar e recriar).
- Cards do dashboard continuam sem dados reais (Fase 4).
