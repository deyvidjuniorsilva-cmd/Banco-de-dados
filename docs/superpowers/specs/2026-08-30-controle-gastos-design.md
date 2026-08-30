# Controle de Gastos Pessoais — Design

## Visão geral

Site pessoal, hospedado na nuvem, para acompanhar gastos e receitas a
partir de extratos e faturas em PDF de múltiplos bancos/cartões. O
usuário faz upload do PDF, revisa e corrige as transações extraídas
automaticamente, categoriza, e acompanha um dashboard com orçamento
mensal por categoria e alertas de gasto anômalo.

Uso: um único usuário (o dono), acesso via login.

## Stack

- **Frontend/Backend:** Next.js (App Router), TypeScript
- **Banco de dados:** Postgres via Supabase
- **Autenticação:** Supabase Auth (email + senha), conta única
- **Armazenamento de arquivos:** Supabase Storage (PDFs originais)
- **Deploy:** Vercel
- **Extração de texto de PDF:** biblioteca `pdf-parse` (ou equivalente) no backend (API route / server action)

## Bancos suportados (parsers dedicados)

1. Nubank (conta e/ou cartão)
2. Sicoob Credivar
3. Banco do Brasil
4. Mercado Pago

Cada parser é um módulo independente que recebe o texto bruto extraído
do PDF e devolve uma lista de transações candidatas: `{ data,
descrição, valor, tipo (entrada/saída) }`. Todos os parsers implementam
a mesma interface (`BankParser`), permitindo adicionar novos bancos no
futuro sem alterar o restante do sistema.

Como o layout de cada banco pode variar entre versões de fatura/extrato,
o parser não precisa ser perfeito — a tela de revisão manual é a rede de
segurança. Se um parser não reconhecer o formato do arquivo, o sistema
cai para uma extração genérica (linha com padrão data + valor) e sinaliza
"formato não identificado — revise com atenção".

## Fluxo principal

1. **Login** — email/senha via Supabase Auth.
2. **Upload** — usuário escolhe o banco/cartão de origem e envia o PDF.
   Arquivo salvo no Storage; texto extraído no servidor.
3. **Parsing** — parser do banco escolhido roda sobre o texto e retorna
   transações candidatas.
4. **Categorização automática** — cada transação passa pelo motor de
   regras por palavra-chave (ex.: contém "UBER" → Transporte) e recebe
   uma categoria sugerida (ou "Sem categoria" se nenhuma regra bater).
5. **Tela de revisão** — lista editável das transações candidatas:
   usuário pode corrigir data/descrição/valor, trocar categoria,
   remover linhas indevidas ou adicionar linhas que faltaram. Nada é
   persistido como definitivo até confirmação nesta tela.
6. **Salvar** — transações confirmadas são gravadas no banco, vinculadas
   ao arquivo de origem (para rastreabilidade e evitar duplicar import).
7. **Dashboard** — visão consolidada (ver seção abaixo).

## Modelo de dados (alto nível)

- `accounts` — bancos/cartões cadastrados pelo usuário (nome, tipo: conta/cartão)
- `imports` — cada upload de PDF (arquivo, banco, data de importação, status)
- `transactions` — data, descrição, valor, tipo (entrada/saída), categoria, `import_id`, `account_id`
- `categories` — nome, cor/ícone (opcional)
- `category_rules` — palavra-chave → categoria (editável pelo usuário)
- `budgets` — categoria, mês/ano, valor limite definido pelo usuário

## Categorização

Regras fixas por palavra-chave, gerenciadas pelo usuário em uma tela de
configurações (CRUD simples: adicionar/editar/remover regra). Regras são
aplicadas na ordem de cadastro; a primeira que bater na descrição define
a categoria sugerida. Sempre editável na tela de revisão ou depois,
direto na lista de transações.

## Orçamento e análise de gastos

Duas fontes de alerta, combinadas:

1. **Orçamento mensal por categoria** — usuário define um valor limite
   por categoria (ex.: R$800 em Mercado). Dashboard mostra
   gasto-atual/limite por categoria, com destaque visual quando
   ultrapassado ou próximo (ex.: >90%).
2. **Comparação histórica** — para cada categoria, o sistema calcula a
   média dos últimos N meses (ex.: 3 ou 6) e sinaliza quando o mês atual
   está significativamente acima dessa média (ex.: >30%), mesmo sem
   orçamento definido para aquela categoria.

O dashboard consolida os dois: resumo do mês (receitas, gastos, saldo),
gráfico de gastos por categoria, lista de categorias em alerta (por
orçamento e/ou por variação histórica), e recomendações textuais simples
(ex.: "Você gastou 42% a mais em Lazer este mês comparado à média dos
últimos 3 meses").

## Fora de escopo (YAGNI, por ora)

- Extração via IA/OCR — descartado a favor de parsers dedicados + revisão manual
- Múltiplos usuários / multi-tenant
- Conciliação automática entre fatura de cartão e extrato de conta
- Metas de economia, projeções futuras, exportação de relatórios

## Testes

- Testes unitários por parser (fixtures de texto extraído real —
  anonimizado — de cada banco, cobrindo casos comuns e casos-limite como
  parcelamentos, estornos, valores negativos)
- Testes do motor de regras de categorização
- Testes do cálculo de orçamento/alerta histórico
