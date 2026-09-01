# Fase 5 — Lançamento de despesas via WhatsApp

## Objetivo

Permitir que o usuário envie uma foto ou PDF de um comprovante de compra pelo
WhatsApp e o sistema extraia os dados (valor, data, descrição), pergunte a
conta/cartão envolvido, categorize automaticamente e lance a transação no
banco após confirmação — sem precisar abrir o app.

## Contexto e decisões já tomadas

- Confirmação obrigatória antes de lançar (o usuário responde "sim"/"não"; sem
  edição de campos por texto no MVP — correções erradas são ajustadas depois
  na tela de Transações, que já suporta edição inline).
- Provedor: **WhatsApp Cloud API oficial da Meta** (gratuito no volume de uso,
  sem risco de banimento do número, reaproveita o deploy existente na Vercel).
- Extração de dados via **IA multimodal (Claude, modelo `claude-opus-5`)**
  lendo a imagem/PDF diretamente — não OCR tradicional.
- As despesas lançadas via WhatsApp também podem aparecer depois num extrato
  bancário importado — é necessário detectar e evitar duplicidade na
  importação.
- A conta (Nubank/Sicoob/BB/Mercado Pago) é perguntada a cada comprovante, não
  fixa.

## Arquitetura

Tudo roda dentro do app Next.js já hospedado na Vercel — nenhuma
infraestrutura nova.

```
WhatsApp (usuário) ──envia foto/PDF──▶ Meta Cloud API
                                             │ webhook POST
                                             ▼
                          app/api/whatsapp/webhook/route.ts
                                             │
                    ┌────────────────────────┼─────────────────────────┐
                    ▼                        ▼                         ▼
        baixa mídia da Graph API   extrai dados via Claude   grava/lê estado da
        (fetch + access token)     (vision, tool use)        conversa (Supabase,
                                                                service role)
                                             │
                                             ▼
                          envia mensagem de volta via Graph API
                          (pergunta conta → pede confirmação → lança)
```

A rota de webhook responde:
- `GET` — desafio de verificação da Meta (`hub.challenge`), comparando
  `hub.verify_token` com `WHATSAPP_VERIFY_TOKEN`.
- `POST` — mensagens recebidas. Valida a assinatura `X-Hub-Signature-256` com
  `WHATSAPP_APP_SECRET` antes de processar qualquer coisa.

## Filtro de remetente

Só processamos mensagens cujo número de origem bate com `WHATSAPP_OWNER_PHONE`
(variável de ambiente). Qualquer outro número recebe um `200 OK` vazio (sem
resposta, sem processamento) — evita que a rota vire um endpoint aberto de
spam/abuso.

## Estado da conversa

Nova tabela `whatsapp_pending_receipts`, já que cada request do webhook é
isolado (serverless, sem memória entre mensagens):

```sql
create table whatsapp_pending_receipts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  status text not null check (status in ('aguardando_conta', 'aguardando_confirmacao')),
  extracted_date date not null,
  extracted_description text not null,
  extracted_amount numeric(12,2) not null,
  extracted_direction text not null check (extracted_direction in ('entrada', 'saida')),
  account_id uuid references accounts(id),
  category_id uuid references categories(id),
  created_at timestamptz not null default now()
);

create index whatsapp_pending_receipts_phone_idx on whatsapp_pending_receipts(phone);
```

RLS habilitada com a mesma política `owner = auth.uid()` das outras tabelas
(por consistência), mas o webhook acessa via **service role key**, que
ignora RLS — não há sessão de usuário autenticada numa requisição de webhook.

Uma pendência mais velha que 30 minutos é tratada como expirada: ao chegar
uma nova mensagem, o webhook primeiro apaga pendências expiradas daquele
telefone antes de processar.

## Fluxo passo a passo

1. **Usuário manda foto/PDF.** O webhook identifica o tipo de mídia
   (`image` ou `document`), baixa os bytes via Graph API
   (`GET /{media-id}` → URL temporária → `GET` autenticado nessa URL).
2. **Extração via Claude.** Uma chamada a `client.messages.create` com
   `model: "claude-opus-5"`, o conteúdo como bloco `image` (base64) ou
   `document` (PDF base64), e uma tool forçada (`tool_choice`) com schema
   `{ date: string, description: string, amount: number, direction: "entrada"|"saida" }`.
   - Se a chamada falhar em extrair (Claude não preenche a tool, ou erro),
     responde: *"Não consegui ler esse comprovante. Pode mandar de novo, mais
     nítido?"* e não cria nada.
3. **Categorização automática.** Usa `matchCategory` (`lib/categorization.ts`)
   já existente com as regras de `category_rules`.
4. **Grava pendência** com `status: 'aguardando_conta'` e responde com a
   lista numerada das contas reais do usuário (`accounts.name`, na ordem em
   que foram criadas — não uma lista fixa de bancos, já que pode haver mais
   de uma conta por banco, ex: "Nubank (cartão)" e "Nubank (conta)"):
   *"Farmácia • R$ 29,90 • 12/08 — qual conta? 1) Nubank (cartão) 2) Sicoob
   Credivar (conta)"*
5. **Usuário responde com o número da conta.** Se não bater com nenhuma
   opção, repete a pergunta. Se bater, atualiza `account_id`, muda
   `status` para `aguardando_confirmacao` e responde:
   *"Farmácia • R$ 29,90 • 12/08 • Nubank — confirma? (sim/não)"*
6. **Usuário responde "sim"/"não".**
   - "sim" → insere em `transactions` (mesmo formato usado pela importação de
     extrato, com `import_id: null`), apaga a pendência, responde
     *"Lançado ✅"*.
   - "não" (ou qualquer outra coisa) → apaga a pendência, responde
     *"Cancelado."*

## Prevenção de duplicidade na importação de extrato

Quando o usuário importa um extrato em `/dashboard/importar`
(`confirm-action.ts` / fluxo de revisão), cada linha parseada do PDF é
comparada com transações já existentes daquela mesma conta: mesmo valor
exato e `occurred_on` dentro de ±2 dias. Se houver uma correspondência, a
linha na tela de revisão:
- vem **desmarcada** para importação por padrão,
- mostra um aviso "possível duplicata — já lançado em DD/MM via WhatsApp".

O usuário pode marcar manualmente se quiser importar mesmo assim (ex: eram
duas compras diferentes por coincidência no mesmo valor).

## Segurança

- Assinatura do webhook validada (`X-Hub-Signature-256`, HMAC-SHA256 com
  `WHATSAPP_APP_SECRET`) antes de qualquer processamento.
- Filtro por número de telefone (`WHATSAPP_OWNER_PHONE`).
- `SUPABASE_SERVICE_ROLE_KEY` usada só nesse endpoint de servidor, nunca
  exposta ao cliente.
- `owner` das linhas gravadas é fixado via `APP_OWNER_ID` (variável de
  ambiente com o UUID do usuário único do sistema).

## Variáveis de ambiente novas

| Variável | Origem |
|---|---|
| `ANTHROPIC_API_KEY` | Console da Anthropic |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel do Supabase → Project Settings → API |
| `WHATSAPP_ACCESS_TOKEN` | Meta for Developers → app → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta for Developers → app → WhatsApp → API Setup |
| `WHATSAPP_VERIFY_TOKEN` | Definido por nós (string arbitrária) |
| `WHATSAPP_APP_SECRET` | Meta for Developers → app → Configurações básicas |
| `WHATSAPP_OWNER_PHONE` | Seu número, formato E.164 (ex: 5511999999999) |
| `APP_OWNER_ID` | UUID do usuário no Supabase Auth |

## Custo estimado

~$0,01–0,02 por comprovante processado (chamada de visão ao Claude). WhatsApp
Cloud API é gratuito nesse volume de uso pessoal.

## Testes

- Unitários: extração de tool-input do Claude (mock da resposta da API),
  `matchCategory` (já existe), detecção de duplicidade (nova função pura
  `findPossibleDuplicate(parsedRow, existingTransactions)`), validação de
  assinatura do webhook.
- Manual: enviar uma foto real de comprovante pro número de teste da Meta e
  percorrer o fluxo completo (extrair → escolher conta → confirmar → ver a
  transação aparecer no dashboard).

## Fora de escopo (não faz parte deste plano)

- Correção de campos por texto livre no WhatsApp.
- Suporte a múltiplos usuários (o sistema continua single-user).
- Envio de comprovantes por outros canais (Telegram, e-mail, etc).
