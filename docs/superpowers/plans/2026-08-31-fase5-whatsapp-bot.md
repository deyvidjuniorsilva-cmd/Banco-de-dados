# Fase 5 — Lançamento de despesas via WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user send a photo/PDF of a purchase receipt over WhatsApp, have Claude extract the amount/date/description, ask which account it belongs to, categorize it automatically, and launch the transaction after a "sim"/"não" confirmation.

**Architecture:** A single new Next.js API route (`app/api/whatsapp/webhook`) receives WhatsApp Cloud API webhooks, orchestrating small pure/testable modules under `lib/whatsapp/` (signature verification, payload parsing, message building/parsing) plus `lib/receipt-extraction.ts` (Claude vision call) and `lib/duplicates.ts` (shared by both the webhook and the existing PDF-import review flow). Conversation state between WhatsApp messages is persisted in a new `whatsapp_pending_receipts` table, read/written via a service-role Supabase client (no user session exists in a webhook request).

**Tech Stack:** Next.js App Router route handlers, `@anthropic-ai/sdk` (Claude Opus 5, vision + forced tool use), `@supabase/supabase-js` service-role client, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-fase5-whatsapp-bot-design.md`

## Global Constraints

- All user-facing WhatsApp messages and UI copy are in Portuguese (pt-BR), matching the rest of the app.
- Model for extraction: `claude-opus-5` (per project default — do not substitute another model).
- Every pure/logic function gets a Vitest unit test written first (TDD), following the project's existing convention of testing pure helpers and leaving thin route/action orchestration manually verified (see `app/dashboard/importar/confirm-action.ts`, which has no test file, vs. `lib/categorization.ts`, which does).
- Money comparisons use a small epsilon (`0.001`) instead of exact float equality, matching how `numeric(12,2)` values round-trip through JS numbers.
- Dates are stored/compared as `YYYY-MM-DD` strings, matching the existing `ParsedTransaction`/`DashboardTransaction` convention in this codebase.
- New Supabase tables follow the existing RLS pattern in `supabase/migrations/0001_init.sql` (`owner` column + `owner_all_<table>` policy), even though the webhook itself uses the service-role key and bypasses RLS.

---

### Task 1: Migration for `whatsapp_pending_receipts` + service-role Supabase client

**Files:**
- Create: `supabase/migrations/0002_whatsapp_pending_receipts.sql`
- Create: `lib/supabase/service.ts`
- Test: none (infra/config task — no pure logic to unit test; verified by running the migration and importing the client in Task 9)

**Interfaces:**
- Produces: `createServiceClient(): SupabaseClient` — used by the webhook route in Task 9.

- [ ] **Step 1: Write the migration**

```sql
-- 0002_whatsapp_pending_receipts.sql

create table if not exists whatsapp_pending_receipts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  phone text not null,
  status text not null check (status in ('aguardando_conta', 'aguardando_confirmacao')),
  extracted_date date not null,
  extracted_description text not null,
  extracted_amount numeric(12, 2) not null,
  extracted_direction text not null check (extracted_direction in ('entrada', 'saida')),
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_pending_receipts_phone_idx on whatsapp_pending_receipts(phone);

alter table whatsapp_pending_receipts enable row level security;

create policy "owner_all_whatsapp_pending_receipts" on whatsapp_pending_receipts
  for all using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Run this SQL in the Supabase dashboard SQL editor (Project → SQL Editor → New query), same as prior migrations in `supabase/migrations/`. Confirm the table appears under Table Editor.

- [ ] **Step 3: Add the service-role Supabase client helper**

```typescript
// lib/supabase/service.ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./require-env";

export function createServiceClient() {
  return createSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_whatsapp_pending_receipts.sql lib/supabase/service.ts
git commit -m "feat: add whatsapp_pending_receipts table and service-role Supabase client"
```

---

### Task 2: Duplicate-detection helper (`lib/duplicates.ts`)

**Files:**
- Create: `lib/duplicates.ts`
- Test: `lib/duplicates.test.ts`

**Interfaces:**
- Produces: `findPossibleDuplicate(row: { date: string; amount: number }, existing: DedupCandidate[]): boolean` and `interface DedupCandidate { occurredOn: string; amount: number }` — consumed by Task 3 (import review) and referenced conceptually by the webhook flow (Task 9 inserts transactions that later get caught by this same function when a statement is imported).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/duplicates.test.ts
import { describe, expect, it } from "vitest";
import { findPossibleDuplicate } from "./duplicates";

describe("findPossibleDuplicate", () => {
  it("detecta duplicata com mesma data e mesmo valor", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-12", amount: 29.9 }]
    );
    expect(result).toBe(true);
  });

  it("detecta duplicata com data até 2 dias de diferença", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-14", amount: 29.9 }]
    );
    expect(result).toBe(true);
  });

  it("não detecta duplicata quando a data está a mais de 2 dias", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-15", amount: 29.9 }]
    );
    expect(result).toBe(false);
  });

  it("não detecta duplicata quando o valor é diferente", () => {
    const result = findPossibleDuplicate(
      { date: "2026-08-12", amount: 29.9 },
      [{ occurredOn: "2026-08-12", amount: 35.0 }]
    );
    expect(result).toBe(false);
  });

  it("retorna false para lista vazia de transações existentes", () => {
    expect(findPossibleDuplicate({ date: "2026-08-12", amount: 29.9 }, [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/duplicates.test.ts`
Expected: FAIL — `Cannot find module './duplicates'`

- [ ] **Step 3: Implement**

```typescript
// lib/duplicates.ts
export interface DedupCandidate {
  occurredOn: string;
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AMOUNT_EPSILON = 0.001;
const MAX_DAY_DIFFERENCE = 2;

export function findPossibleDuplicate(
  row: { date: string; amount: number },
  existing: DedupCandidate[]
): boolean {
  const rowDate = new Date(`${row.date}T00:00:00Z`).getTime();

  return existing.some((candidate) => {
    if (Math.abs(candidate.amount - row.amount) > AMOUNT_EPSILON) return false;
    const candidateDate = new Date(`${candidate.occurredOn}T00:00:00Z`).getTime();
    const dayDifference = Math.abs(candidateDate - rowDate) / DAY_MS;
    return dayDifference <= MAX_DAY_DIFFERENCE;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/duplicates.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/duplicates.ts lib/duplicates.test.ts
git commit -m "feat: add findPossibleDuplicate helper"
```

---

### Task 3: Wire duplicate detection into the import review screen

**Files:**
- Modify: `lib/transactions.ts`
- Modify: `app/dashboard/importar/review-table.tsx`
- Test: `lib/transactions.test.ts` (new)

**Interfaces:**
- Consumes: `findPossibleDuplicate` and `DedupCandidate` from Task 2 (`lib/duplicates.ts`).
- Produces: `listTransactionsForAccount(supabase, accountId): Promise<DedupCandidate[]>` — a thin Supabase query, not unit-tested directly (matches the existing untested-Supabase-call pattern in `lib/transactions.ts`); the row-mapping logic it depends on (`findPossibleDuplicate`) is already tested in Task 2. Instead, this task's test covers the pure row-mapping used inside `review-table.tsx`.

- [ ] **Step 1: Add `listTransactionsForAccount` to `lib/transactions.ts`**

```typescript
// lib/transactions.ts — add below the existing imports/functions
import type { DedupCandidate } from "./duplicates";

export async function listTransactionsForAccount(
  supabase: SupabaseClient,
  accountId: string
): Promise<DedupCandidate[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("occurred_on, amount")
    .eq("account_id", accountId);
  if (error) throw error;
  return data.map((row) => ({ occurredOn: row.occurred_on, amount: row.amount }));
}
```

- [ ] **Step 2: Write the failing test for the row-mapping used in the review table**

This tests the pure logic that will drive each row's default "included" checkbox state — extracted as its own function so it's testable without rendering the component.

```typescript
// lib/transactions.test.ts
import { describe, expect, it } from "vitest";
import { markDuplicateRows } from "./transactions";
import type { ParsedTransaction } from "./parsers/types";

describe("markDuplicateRows", () => {
  it("marca como duplicata e desmarca a inclusão quando bate com uma transação existente", () => {
    const rows: ParsedTransaction[] = [
      { date: "2026-08-12", description: "Drogaria", amount: 29.9, direction: "saida" },
    ];
    const existing = [{ occurredOn: "2026-08-12", amount: 29.9 }];

    const result = markDuplicateRows(rows, existing);

    expect(result).toEqual([
      {
        date: "2026-08-12",
        description: "Drogaria",
        amount: 29.9,
        direction: "saida",
        possibleDuplicate: true,
        included: false,
      },
    ]);
  });

  it("mantém incluída uma linha sem correspondência", () => {
    const rows: ParsedTransaction[] = [
      { date: "2026-08-12", description: "Mercado", amount: 100, direction: "saida" },
    ];

    const result = markDuplicateRows(rows, []);

    expect(result[0].possibleDuplicate).toBe(false);
    expect(result[0].included).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/transactions.test.ts`
Expected: FAIL — `markDuplicateRows is not exported`

- [ ] **Step 4: Implement `markDuplicateRows` in `lib/transactions.ts`**

```typescript
// lib/transactions.ts — add
import { findPossibleDuplicate } from "./duplicates";
import type { ParsedTransaction } from "./parsers/types";

export interface DuplicateCheckedRow extends ParsedTransaction {
  possibleDuplicate: boolean;
  included: boolean;
}

export function markDuplicateRows(
  rows: ParsedTransaction[],
  existing: DedupCandidate[]
): DuplicateCheckedRow[] {
  return rows.map((row) => {
    const possibleDuplicate = findPossibleDuplicate(row, existing);
    return { ...row, possibleDuplicate, included: !possibleDuplicate };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/transactions.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Wire it into `ReviewTable`**

In `app/dashboard/importar/review-table.tsx`:
- Change `Row` to extend `DuplicateCheckedRow` instead of `ParsedTransaction` (it already adds `categoryId`).
- In the `useEffect` that currently loads categories/rules, also call `listTransactionsForAccount(supabase, accountId)` and merge the duplicate flags in with `markDuplicateRows`.
- Add a checkbox column (bound to `row.included`) and, when `row.possibleDuplicate` is true, a small warning label under the description cell reading `"Possível duplicata — já lançado antes"`.
- In `handleConfirm`, filter `rows` to `rows.filter((r) => r.included)` before calling `confirmarImport`.

```typescript
// app/dashboard/importar/review-table.tsx — key changes (apply in context of the existing file)
import { listTransactionsForAccount, markDuplicateRows, type DuplicateCheckedRow } from "@/lib/transactions";

interface Row extends DuplicateCheckedRow {
  categoryId: string | null;
}

// inside the component, replace the initial useState:
const [rows, setRows] = useState<Row[]>(
  initialTransactions.map((t) => ({ ...t, categoryId: null, possibleDuplicate: false, included: true }))
);

// inside loadCategorizationData's Promise.all, add the existing-transactions fetch:
const [categoryList, ruleList, existingTransactions] = await Promise.all([
  listCategories(supabase),
  listCategoryRules(supabase),
  listTransactionsForAccount(supabase, accountId),
]);
setCategories(categoryList);
setRows((prev) => {
  const withDuplicateFlags = markDuplicateRows(prev, existingTransactions);
  return withDuplicateFlags.map((row, i) => ({
    ...row,
    categoryId: prev[i].categoryId ?? matchCategory(row.description, ruleList),
  }));
});

// in the table header row, add a new <th className="p-2">Incluir</th> as the first column
// in each body row, add a new first <td> with:
<td className="p-2">
  <input
    type="checkbox"
    checked={row.included}
    onChange={(e) => updateRow(index, { included: e.target.checked })}
  />
  {row.possibleDuplicate && (
    <p className="mt-1 text-xs text-warning">Possível duplicata</p>
  )}
</td>

// in handleConfirm, before calling confirmarImport:
const response = await confirmarImport(importId, accountId, rows.filter((r) => r.included));
```

- [ ] **Step 7: Typecheck and run the full test suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no type errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/transactions.ts lib/transactions.test.ts app/dashboard/importar/review-table.tsx
git commit -m "feat: flag and auto-exclude probable duplicate rows during import review"
```

---

### Task 4: WhatsApp webhook signature verification

**Files:**
- Create: `lib/whatsapp/signature.ts`
- Test: `lib/whatsapp/signature.test.ts`

**Interfaces:**
- Produces: `verifyWhatsappSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean` — consumed by the webhook route in Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whatsapp/signature.test.ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWhatsappSignature } from "./signature";

const APP_SECRET = "test-secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex");
}

describe("verifyWhatsappSignature", () => {
  it("aceita uma assinatura válida", () => {
    const body = '{"hello":"world"}';
    expect(verifyWhatsappSignature(body, sign(body), APP_SECRET)).toBe(true);
  });

  it("rejeita uma assinatura de outro corpo", () => {
    const body = '{"hello":"world"}';
    expect(verifyWhatsappSignature(body, sign('{"other":"body"}'), APP_SECRET)).toBe(false);
  });

  it("rejeita quando o header está ausente", () => {
    expect(verifyWhatsappSignature('{"a":1}', null, APP_SECRET)).toBe(false);
  });

  it("rejeita uma assinatura com segredo errado", () => {
    const body = '{"hello":"world"}';
    const wrongSignature =
      "sha256=" + createHmac("sha256", "wrong-secret").update(body, "utf8").digest("hex");
    expect(verifyWhatsappSignature(body, wrongSignature, APP_SECRET)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whatsapp/signature.test.ts`
Expected: FAIL — `Cannot find module './signature'`

- [ ] **Step 3: Implement**

```typescript
// lib/whatsapp/signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWhatsappSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader) return false;

  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whatsapp/signature.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/signature.ts lib/whatsapp/signature.test.ts
git commit -m "feat: add WhatsApp webhook signature verification"
```

---

### Task 5: WhatsApp Graph API client (send message, download media)

**Files:**
- Create: `lib/whatsapp/graph-client.ts`
- Test: `lib/whatsapp/graph-client.test.ts`

**Interfaces:**
- Produces:
  - `interface DownloadedMedia { data: Buffer; mimeType: string }`
  - `downloadWhatsappMedia(mediaId: string, accessToken: string): Promise<DownloadedMedia>`
  - `interface GraphConfig { phoneNumberId: string; accessToken: string }`
  - `sendWhatsappText(to: string, body: string, config: GraphConfig): Promise<void>`
- Consumed by the webhook route in Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whatsapp/graph-client.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWhatsappMedia, sendWhatsappText } from "./graph-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadWhatsappMedia", () => {
  it("busca a URL da mídia e depois baixa os bytes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://cdn.example.com/file", mime_type: "image/jpeg" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWhatsappMedia("media-123", "token-abc");

    expect(result.mimeType).toBe("image/jpeg");
    expect(Buffer.from(result.data)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/media-123",
      { headers: { Authorization: "Bearer token-abc" } }
    );
  });

  it("lança erro quando a busca de metadados falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }));
    await expect(downloadWhatsappMedia("media-123", "token-abc")).rejects.toThrow();
  });
});

describe("sendWhatsappText", () => {
  it("envia uma mensagem de texto para o número informado", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await sendWhatsappText("5511999999999", "Lançado ✅", {
      phoneNumberId: "phone-1",
      accessToken: "token-abc",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/phone-1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "5511999999999",
      type: "text",
      text: { body: "Lançado ✅" },
    });
  });

  it("lança erro quando o envio falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));
    await expect(
      sendWhatsappText("5511999999999", "oi", { phoneNumberId: "phone-1", accessToken: "t" })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whatsapp/graph-client.test.ts`
Expected: FAIL — `Cannot find module './graph-client'`

- [ ] **Step 3: Implement**

```typescript
// lib/whatsapp/graph-client.ts
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export interface DownloadedMedia {
  data: Buffer;
  mimeType: string;
}

export async function downloadWhatsappMedia(
  mediaId: string,
  accessToken: string
): Promise<DownloadedMedia> {
  const metaResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Falha ao buscar metadados da mídia: ${metaResponse.status}`);
  }
  const meta = (await metaResponse.json()) as { url: string; mime_type: string };

  const fileResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileResponse.ok) {
    throw new Error(`Falha ao baixar mídia: ${fileResponse.status}`);
  }
  const arrayBuffer = await fileResponse.arrayBuffer();
  return { data: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}

export interface GraphConfig {
  phoneNumberId: string;
  accessToken: string;
}

export async function sendWhatsappText(
  to: string,
  body: string,
  config: GraphConfig
): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao enviar mensagem WhatsApp: ${response.status}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whatsapp/graph-client.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/graph-client.ts lib/whatsapp/graph-client.test.ts
git commit -m "feat: add WhatsApp Graph API client for media download and sending text"
```

---

### Task 6: Parse incoming WhatsApp webhook payloads

**Files:**
- Create: `lib/whatsapp/webhook-payload.ts`
- Test: `lib/whatsapp/webhook-payload.test.ts`

**Interfaces:**
- Produces:
  - `interface IncomingWhatsappMessage { from: string; type: "image" | "document" | "text" | "unknown"; mediaId?: string; mimeType?: string; text?: string }`
  - `parseIncomingMessage(payload: unknown): IncomingWhatsappMessage | null`
- Consumed by the webhook route in Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whatsapp/webhook-payload.test.ts
import { describe, expect, it } from "vitest";
import { parseIncomingMessage } from "./webhook-payload";

function payloadWith(message: Record<string, unknown>) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

describe("parseIncomingMessage", () => {
  it("extrai uma mensagem de imagem", () => {
    const result = parseIncomingMessage(
      payloadWith({
        from: "5511999999999",
        type: "image",
        image: { id: "media-1", mime_type: "image/jpeg" },
      })
    );
    expect(result).toEqual({
      from: "5511999999999",
      type: "image",
      mediaId: "media-1",
      mimeType: "image/jpeg",
    });
  });

  it("extrai uma mensagem de documento (PDF)", () => {
    const result = parseIncomingMessage(
      payloadWith({
        from: "5511999999999",
        type: "document",
        document: { id: "media-2", mime_type: "application/pdf" },
      })
    );
    expect(result).toEqual({
      from: "5511999999999",
      type: "document",
      mediaId: "media-2",
      mimeType: "application/pdf",
    });
  });

  it("extrai uma mensagem de texto", () => {
    const result = parseIncomingMessage(
      payloadWith({ from: "5511999999999", type: "text", text: { body: "sim" } })
    );
    expect(result).toEqual({ from: "5511999999999", type: "text", text: "sim" });
  });

  it("retorna null quando não há mensagens no payload (ex: status de entrega)", () => {
    const payload = { entry: [{ changes: [{ value: {} }] }] };
    expect(parseIncomingMessage(payload)).toBeNull();
  });

  it("retorna null para um payload malformado", () => {
    expect(parseIncomingMessage({})).toBeNull();
    expect(parseIncomingMessage(null)).toBeNull();
  });

  it("marca tipos não suportados como 'unknown'", () => {
    const result = parseIncomingMessage(
      payloadWith({ from: "5511999999999", type: "audio" })
    );
    expect(result).toEqual({ from: "5511999999999", type: "unknown" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whatsapp/webhook-payload.test.ts`
Expected: FAIL — `Cannot find module './webhook-payload'`

- [ ] **Step 3: Implement**

```typescript
// lib/whatsapp/webhook-payload.ts
export interface IncomingWhatsappMessage {
  from: string;
  type: "image" | "document" | "text" | "unknown";
  mediaId?: string;
  mimeType?: string;
  text?: string;
}

export function parseIncomingMessage(payload: unknown): IncomingWhatsappMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const entry = (payload as Record<string, unknown>).entry;
  if (!Array.isArray(entry) || entry.length === 0) return null;

  const changes = (entry[0] as Record<string, unknown>)?.changes;
  if (!Array.isArray(changes) || changes.length === 0) return null;

  const value = (changes[0] as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
  const messages = value?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const message = messages[0] as Record<string, unknown>;
  const from = message.from;
  const type = message.type;
  if (typeof from !== "string" || typeof type !== "string") return null;

  if (type === "image" || type === "document") {
    const media = message[type] as Record<string, unknown> | undefined;
    const mediaId = media?.id;
    const mimeType = media?.mime_type;
    if (typeof mediaId !== "string") return { from, type: "unknown" };
    return {
      from,
      type,
      mediaId,
      mimeType: typeof mimeType === "string" ? mimeType : undefined,
    };
  }

  if (type === "text") {
    const text = message.text as Record<string, unknown> | undefined;
    const body = text?.body;
    return { from, type: "text", text: typeof body === "string" ? body : "" };
  }

  return { from, type: "unknown" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whatsapp/webhook-payload.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/webhook-payload.ts lib/whatsapp/webhook-payload.test.ts
git commit -m "feat: parse incoming WhatsApp webhook message payloads"
```

---

### Task 7: Conversation message building/parsing

**Files:**
- Create: `lib/whatsapp/conversation.ts`
- Test: `lib/whatsapp/conversation.test.ts`

**Interfaces:**
- Consumes: `ExtractedReceipt` shape (defined in Task 8 as `{ date: string; description: string; amount: number; direction: "entrada" | "saida" }` — this task defines its own local parameter types matching that shape so it has no import-order dependency on Task 8).
- Produces:
  - `buildAccountPrompt(receipt: ReceiptSummary, accounts: { id: string; name: string }[]): string`
  - `parseAccountSelection(reply: string, accounts: { id: string; name: string }[]): string | null`
  - `buildConfirmationPrompt(receipt: ReceiptSummary, accountName: string): string`
  - `parseConfirmationReply(reply: string): "confirm" | "cancel" | "unknown"`
- Consumed by the webhook route in Task 9.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whatsapp/conversation.test.ts
import { describe, expect, it } from "vitest";
import {
  buildAccountPrompt,
  buildConfirmationPrompt,
  parseAccountSelection,
  parseConfirmationReply,
} from "./conversation";

const RECEIPT = {
  date: "2026-08-12",
  description: "Farmacia",
  amount: 29.9,
  direction: "saida" as const,
};

const ACCOUNTS = [
  { id: "acc-1", name: "Nubank (cartão)" },
  { id: "acc-2", name: "Sicoob Credivar (conta)" },
];

describe("buildAccountPrompt", () => {
  it("lista as contas numeradas com os dados extraídos", () => {
    const prompt = buildAccountPrompt(RECEIPT, ACCOUNTS);
    expect(prompt).toContain("R$ 29,90");
    expect(prompt).toContain("12/08");
    expect(prompt).toContain("Farmacia");
    expect(prompt).toContain("1) Nubank (cartão)");
    expect(prompt).toContain("2) Sicoob Credivar (conta)");
  });
});

describe("parseAccountSelection", () => {
  it("aceita o número da opção", () => {
    expect(parseAccountSelection("1", ACCOUNTS)).toBe("acc-1");
    expect(parseAccountSelection("2", ACCOUNTS)).toBe("acc-2");
  });

  it("aceita o nome da conta (case-insensitive, parcial)", () => {
    expect(parseAccountSelection("nubank", ACCOUNTS)).toBe("acc-1");
  });

  it("retorna null para uma resposta que não corresponde a nenhuma conta", () => {
    expect(parseAccountSelection("banco inexistente", ACCOUNTS)).toBeNull();
  });

  it("retorna null para um número fora do intervalo", () => {
    expect(parseAccountSelection("9", ACCOUNTS)).toBeNull();
  });
});

describe("buildConfirmationPrompt", () => {
  it("monta a mensagem de confirmação com os dados e a conta escolhida", () => {
    const prompt = buildConfirmationPrompt(RECEIPT, "Nubank (cartão)");
    expect(prompt).toContain("Farmacia");
    expect(prompt).toContain("R$ 29,90");
    expect(prompt).toContain("12/08");
    expect(prompt).toContain("Nubank (cartão)");
    expect(prompt).toContain("sim/não");
  });
});

describe("parseConfirmationReply", () => {
  it("reconhece variações de confirmação", () => {
    expect(parseConfirmationReply("sim")).toBe("confirm");
    expect(parseConfirmationReply("Sim")).toBe("confirm");
    expect(parseConfirmationReply(" SIM ")).toBe("confirm");
  });

  it("reconhece variações de cancelamento", () => {
    expect(parseConfirmationReply("não")).toBe("cancel");
    expect(parseConfirmationReply("nao")).toBe("cancel");
    expect(parseConfirmationReply("Não")).toBe("cancel");
  });

  it("retorna 'unknown' para qualquer outra resposta", () => {
    expect(parseConfirmationReply("talvez")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whatsapp/conversation.test.ts`
Expected: FAIL — `Cannot find module './conversation'`

- [ ] **Step 3: Implement**

```typescript
// lib/whatsapp/conversation.ts
import { currencyFormatter } from "@/lib/format";

export interface ReceiptSummary {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saida";
}

function formatDateBR(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function summaryLine(receipt: ReceiptSummary): string {
  return `${receipt.description} • ${currencyFormatter.format(receipt.amount)} • ${formatDateBR(receipt.date)}`;
}

export function buildAccountPrompt(
  receipt: ReceiptSummary,
  accounts: { id: string; name: string }[]
): string {
  const options = accounts.map((account, index) => `${index + 1}) ${account.name}`).join(" ");
  return `${summaryLine(receipt)} — qual conta? ${options}`;
}

export function parseAccountSelection(
  reply: string,
  accounts: { id: string; name: string }[]
): string | null {
  const trimmed = reply.trim();
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= accounts.length) {
    return accounts[asNumber - 1].id;
  }

  const normalized = trimmed.toLowerCase();
  const match = accounts.find((account) => account.name.toLowerCase().includes(normalized));
  return match ? match.id : null;
}

export function buildConfirmationPrompt(receipt: ReceiptSummary, accountName: string): string {
  return `${summaryLine(receipt)} • ${accountName} — confirma? (sim/não)`;
}

export function parseConfirmationReply(reply: string): "confirm" | "cancel" | "unknown" {
  const normalized = reply.trim().toLowerCase();
  if (normalized === "sim") return "confirm";
  if (normalized === "não" || normalized === "nao") return "cancel";
  return "unknown";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whatsapp/conversation.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whatsapp/conversation.ts lib/whatsapp/conversation.test.ts
git commit -m "feat: add WhatsApp conversation prompt building and reply parsing"
```

---

### Task 8: Receipt extraction via Claude vision

**Files:**
- Modify: `package.json` (add `@anthropic-ai/sdk`)
- Create: `lib/receipt-extraction.ts`
- Test: `lib/receipt-extraction.test.ts`

**Interfaces:**
- Produces:
  - `interface ExtractedReceipt { date: string; description: string; amount: number; direction: "entrada" | "saida" }`
  - `extractReceiptData(client: Anthropic, media: { data: Buffer; mimeType: string }): Promise<ExtractedReceipt | null>`
- Consumed by the webhook route in Task 9. The `client` parameter is injected (not constructed inside the function) specifically so tests can pass a fake client without hitting the network.

- [ ] **Step 1: Install the SDK**

Run: `npm install @anthropic-ai/sdk`

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/receipt-extraction.test.ts
import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { extractReceiptData } from "./receipt-extraction";

function fakeClient(toolInput: unknown): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: toolInput
          ? [{ type: "tool_use", name: "record_receipt", id: "tool-1", input: toolInput }]
          : [{ type: "text", text: "não consigo ler essa imagem" }],
      }),
    },
  } as unknown as Anthropic;
}

const MEDIA = { data: Buffer.from([1, 2, 3]), mimeType: "image/jpeg" };

describe("extractReceiptData", () => {
  it("retorna os dados extraídos quando o Claude preenche a tool corretamente", async () => {
    const client = fakeClient({
      date: "2026-08-12",
      description: "Farmacia",
      amount: 29.9,
      direction: "saida",
    });

    const result = await extractReceiptData(client, MEDIA);

    expect(result).toEqual({
      date: "2026-08-12",
      description: "Farmacia",
      amount: 29.9,
      direction: "saida",
    });
  });

  it("retorna null quando não há bloco tool_use na resposta", async () => {
    const client = fakeClient(null);
    const result = await extractReceiptData(client, MEDIA);
    expect(result).toBeNull();
  });

  it("retorna null quando o input da tool está malformado", async () => {
    const client = fakeClient({ date: "2026-08-12", amount: "não é número" });
    const result = await extractReceiptData(client, MEDIA);
    expect(result).toBeNull();
  });

  it("envia um bloco document para PDFs e um bloco image para fotos", async () => {
    const client = fakeClient({
      date: "2026-08-12",
      description: "Farmacia",
      amount: 29.9,
      direction: "saida",
    });

    await extractReceiptData(client, { data: Buffer.from([1]), mimeType: "application/pdf" });

    const call = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const contentBlock = call.messages[0].content[0];
    expect(contentBlock.type).toBe("document");
    expect(contentBlock.source.media_type).toBe("application/pdf");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/receipt-extraction.test.ts`
Expected: FAIL — `Cannot find module './receipt-extraction'`

- [ ] **Step 4: Implement**

```typescript
// lib/receipt-extraction.ts
import type Anthropic from "@anthropic-ai/sdk";

export interface ExtractedReceipt {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saida";
}

interface ReceiptMedia {
  data: Buffer;
  mimeType: string;
}

const EXTRACT_TOOL = {
  name: "record_receipt",
  description: "Registra os dados extraídos de um comprovante de compra ou pagamento.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: "string", description: "Data da compra no formato YYYY-MM-DD" },
      description: { type: "string", description: "Descrição curta do estabelecimento ou item" },
      amount: { type: "number", description: "Valor total em reais, sem símbolo de moeda" },
      direction: {
        type: "string",
        enum: ["entrada", "saida"],
        description: "'saida' para gastos, 'entrada' para recebimentos",
      },
    },
    required: ["date", "description", "amount", "direction"],
    additionalProperties: false,
  },
  strict: true,
};

function isExtractedReceipt(input: unknown): input is ExtractedReceipt {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.date === "string" &&
    typeof value.description === "string" &&
    typeof value.amount === "number" &&
    (value.direction === "entrada" || value.direction === "saida")
  );
}

export async function extractReceiptData(
  client: Anthropic,
  media: ReceiptMedia
): Promise<ExtractedReceipt | null> {
  const isPdf = media.mimeType === "application/pdf";
  const contentBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: media.data.toString("base64"),
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: media.mimeType as "image/jpeg" | "image/png" | "image/webp",
          data: media.data.toString("base64"),
        },
      };

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_receipt" },
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text: "Extraia os dados desse comprovante de compra ou pagamento e registre com a ferramenta record_receipt.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;
  if (!isExtractedReceipt(toolUse.input)) return null;

  return toolUse.input;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/receipt-extraction.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/receipt-extraction.ts lib/receipt-extraction.test.ts
git commit -m "feat: extract receipt data from images/PDFs via Claude vision"
```

---

### Task 9: The webhook route (GET verification + POST orchestration)

**Files:**
- Create: `app/api/whatsapp/webhook/route.ts`
- Test: `app/api/whatsapp/webhook/verify.test.ts` (covers only the pure `verifyWebhookChallenge` helper — the POST handler orchestrates already-tested modules plus live Supabase/Graph/Anthropic calls and is verified manually in Step 6, matching this codebase's existing convention of not unit-testing Server Actions/route handlers directly, e.g. `app/dashboard/importar/confirm-action.ts`)

**Interfaces:**
- Consumes everything produced by Tasks 1, 4, 5, 6, 7, 8: `createServiceClient`, `verifyWhatsappSignature`, `downloadWhatsappMedia`, `sendWhatsappText`, `GraphConfig`, `parseIncomingMessage`, `buildAccountPrompt`, `parseAccountSelection`, `buildConfirmationPrompt`, `parseConfirmationReply`, `extractReceiptData`, `matchCategory` (from `lib/categorization.ts`, pre-existing).

- [ ] **Step 1: Write the failing test for the GET verification helper**

```typescript
// app/api/whatsapp/webhook/verify.test.ts
import { describe, expect, it } from "vitest";
import { verifyWebhookChallenge } from "./route";

const VERIFY_TOKEN = "test-verify-token";

describe("verifyWebhookChallenge", () => {
  it("retorna o challenge quando o modo e o token batem", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, VERIFY_TOKEN)).toBe("12345");
  });

  it("retorna null quando o token não bate", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, VERIFY_TOKEN)).toBeNull();
  });

  it("retorna null quando o modo não é subscribe", () => {
    const params = new URLSearchParams({
      "hub.mode": "unsubscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "12345",
    });
    expect(verifyWebhookChallenge(params, VERIFY_TOKEN)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/whatsapp/webhook/verify.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Write the route handler**

```typescript
// app/api/whatsapp/webhook/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/supabase/require-env";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWhatsappSignature } from "@/lib/whatsapp/signature";
import { downloadWhatsappMedia, sendWhatsappText, type GraphConfig } from "@/lib/whatsapp/graph-client";
import { parseIncomingMessage } from "@/lib/whatsapp/webhook-payload";
import {
  buildAccountPrompt,
  buildConfirmationPrompt,
  parseAccountSelection,
  parseConfirmationReply,
  type ReceiptSummary,
} from "@/lib/whatsapp/conversation";
import { extractReceiptData } from "@/lib/receipt-extraction";
import { matchCategory } from "@/lib/categorization";

const PENDING_TTL_MS = 30 * 60 * 1000;

export function verifyWebhookChallenge(
  params: URLSearchParams,
  verifyToken: string
): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return challenge;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const verifyToken = requireEnv("WHATSAPP_VERIFY_TOKEN", process.env.WHATSAPP_VERIFY_TOKEN);
  const challenge = verifyWebhookChallenge(request.nextUrl.searchParams, verifyToken);
  if (challenge === null) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const appSecret = requireEnv("WHATSAPP_APP_SECRET", process.env.WHATSAPP_APP_SECRET);
  const ownerPhone = requireEnv("WHATSAPP_OWNER_PHONE", process.env.WHATSAPP_OWNER_PHONE);
  const ownerId = requireEnv("APP_OWNER_ID", process.env.APP_OWNER_ID);
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN", process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID", process.env.WHATSAPP_PHONE_NUMBER_ID);
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWhatsappSignature(rawBody, signature, appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const message = parseIncomingMessage(JSON.parse(rawBody));
  if (!message || message.from !== ownerPhone) {
    return NextResponse.json({ status: "ignored" });
  }

  const supabase = createServiceClient();
  const graphConfig: GraphConfig = { phoneNumberId, accessToken };

  await supabase
    .from("whatsapp_pending_receipts")
    .delete()
    .eq("owner", ownerId)
    .eq("phone", message.from)
    .lt("created_at", new Date(Date.now() - PENDING_TTL_MS).toISOString());

  const { data: pendingRows } = await supabase
    .from("whatsapp_pending_receipts")
    .select("*")
    .eq("owner", ownerId)
    .eq("phone", message.from)
    .order("created_at", { ascending: false })
    .limit(1);
  const pending = pendingRows?.[0] ?? null;

  if (pending) {
    const receipt: ReceiptSummary = {
      date: pending.extracted_date,
      description: pending.extracted_description,
      amount: pending.extracted_amount,
      direction: pending.extracted_direction,
    };

    if (pending.status === "aguardando_conta") {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("owner", ownerId)
        .order("created_at");
      const accountList = accounts ?? [];
      const accountId = parseAccountSelection(message.text ?? "", accountList);

      if (!accountId) {
        await sendWhatsappText(message.from, buildAccountPrompt(receipt, accountList), graphConfig);
        return NextResponse.json({ status: "reprompted_account" });
      }

      const account = accountList.find((a) => a.id === accountId)!;
      await supabase
        .from("whatsapp_pending_receipts")
        .update({ account_id: accountId, status: "aguardando_confirmacao" })
        .eq("id", pending.id);
      await sendWhatsappText(message.from, buildConfirmationPrompt(receipt, account.name), graphConfig);
      return NextResponse.json({ status: "confirmation_sent" });
    }

    if (pending.status === "aguardando_confirmacao") {
      const decision = parseConfirmationReply(message.text ?? "");

      if (decision === "confirm") {
        await supabase.from("transactions").insert({
          owner: ownerId,
          account_id: pending.account_id,
          occurred_on: pending.extracted_date,
          description: pending.extracted_description,
          amount: pending.extracted_amount,
          direction: pending.extracted_direction,
          category_id: pending.category_id,
        });
        await supabase.from("whatsapp_pending_receipts").delete().eq("id", pending.id);
        await sendWhatsappText(message.from, "Lançado ✅", graphConfig);
        return NextResponse.json({ status: "launched" });
      }

      await supabase.from("whatsapp_pending_receipts").delete().eq("id", pending.id);
      await sendWhatsappText(message.from, "Cancelado.", graphConfig);
      return NextResponse.json({ status: "cancelled" });
    }
  }

  if (message.type === "image" || message.type === "document") {
    const media = await downloadWhatsappMedia(message.mediaId!, accessToken);
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const extracted = await extractReceiptData(anthropic, media);

    if (!extracted) {
      await sendWhatsappText(
        message.from,
        "Não consegui ler esse comprovante. Pode mandar de novo, mais nítido?",
        graphConfig
      );
      return NextResponse.json({ status: "extraction_failed" });
    }

    const [{ data: categoryRules }, { data: accounts }] = await Promise.all([
      supabase
        .from("category_rules")
        .select("keyword, category_id")
        .eq("owner", ownerId)
        .order("position"),
      supabase.from("accounts").select("id, name").eq("owner", ownerId).order("created_at"),
    ]);
    const categoryId = matchCategory(
      extracted.description,
      (categoryRules ?? []).map((r) => ({ keyword: r.keyword, categoryId: r.category_id }))
    );

    await supabase.from("whatsapp_pending_receipts").insert({
      owner: ownerId,
      phone: message.from,
      status: "aguardando_conta",
      extracted_date: extracted.date,
      extracted_description: extracted.description,
      extracted_amount: extracted.amount,
      extracted_direction: extracted.direction,
      category_id: categoryId,
    });

    await sendWhatsappText(message.from, buildAccountPrompt(extracted, accounts ?? []), graphConfig);
    return NextResponse.json({ status: "awaiting_account" });
  }

  return NextResponse.json({ status: "ignored" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/whatsapp/webhook/verify.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm run test`
Expected: no type errors, all tests pass.

- [ ] **Step 6: Manual verification (requires Task 10's setup to be complete)**

Once the Meta app and env vars from Task 10 are in place: send a real photo of a receipt to the WhatsApp test number, confirm the account-selection prompt arrives, reply with the account number, confirm the confirmation prompt arrives, reply "sim", and check that the transaction shows up on `/dashboard/transacoes`.

- [ ] **Step 7: Commit**

```bash
git add app/api/whatsapp/webhook/route.ts app/api/whatsapp/webhook/verify.test.ts
git commit -m "feat: add WhatsApp webhook route for receipt-to-expense flow"
```

---

### Task 10: Setup checklist — Meta app, env vars, deploy

**Files:** none (configuration-only task, no code)

- [ ] **Step 1: Create the Meta for Developers app**

1. Go to https://developers.facebook.com/apps and log in with a Facebook account.
2. Click **Create App** → choose type **Business** → give it a name (e.g. "Controle de Gastos Bot") → **Create App**.
3. On the app dashboard, find **WhatsApp** in the product list and click **Set up**.
4. Under **API Setup**, note down:
   - **Temporary access token** → this is `WHATSAPP_ACCESS_TOKEN` (valid 24h at first; generate a permanent one later under System Users if needed).
   - **Phone number ID** (the test number Meta provides) → this is `WHATSAPP_PHONE_NUMBER_ID`.
5. Under **App settings → Basic**, copy **App secret** → this is `WHATSAPP_APP_SECRET`.
6. Under **API Setup**, add your own WhatsApp number as a recipient test number (Meta requires this for unverified apps) and confirm the verification code sent to your phone.

- [ ] **Step 2: Configure the webhook**

1. Deploy Task 9's code to Vercel first (see Step 4 below) so the URL exists.
2. In the Meta app, go to **WhatsApp → Configuration**.
3. Set **Callback URL** to `https://<your-vercel-domain>/api/whatsapp/webhook`.
4. Set **Verify token** to any string you choose — save that same string as `WHATSAPP_VERIFY_TOKEN`.
5. Click **Verify and save** (Meta calls the `GET` handler from Task 9 to confirm).
6. Under **Webhook fields**, subscribe to `messages`.

- [ ] **Step 3: Gather the remaining values**

- `WHATSAPP_OWNER_PHONE`: your WhatsApp number in E.164 digits with no `+`, e.g. `5511999999999`.
- `APP_OWNER_ID`: in the Supabase dashboard, go to **Authentication → Users**, find your user, copy the **UID**.
- `SUPABASE_SERVICE_ROLE_KEY`: in the Supabase dashboard, go to **Project Settings → API**, copy the **service_role** key (keep this secret — it bypasses RLS).
- `ANTHROPIC_API_KEY`: create one at https://console.anthropic.com/settings/keys.

- [ ] **Step 4: Add the environment variables to Vercel**

1. In the Vercel dashboard, open the project → **Settings → Environment Variables**.
2. Add each of: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_OWNER_PHONE`, `APP_OWNER_ID` — scoped to **Production** (and **Preview** if you want to test on preview deploys).
3. Also add them to your local `.env.local` for local testing.
4. Redeploy (push to `main`, or trigger a redeploy from the Vercel dashboard) so the new env vars take effect.

- [ ] **Step 5: End-to-end smoke test**

Follow Task 9 Step 6 now that everything is wired up.
