# Fase 4a — Dashboard com Dados Reais — Design

## Visão geral

Substituir os placeholders do dashboard e das páginas de detalhe
(Gastos, Receitas, Saldo) por dados reais vindos do banco, com
navegação entre meses. Orçamento por categoria e alertas (histórico e
por limite) ficam para a Fase 4b — este documento cobre apenas a
consolidação e visualização dos dados já importados/categorizados.

## Escopo

- Resumo do mês (saldo, receitas, gastos) nos 3 cards do dashboard.
- Gráfico donut de gastos por categoria no dashboard.
- Navegação entre meses (mês anterior / próximo) via query params.
- Páginas de detalhe (`/dashboard/gastos`, `/dashboard/receitas`,
  `/dashboard/saldo`) mostrando a lista de transações do mês
  selecionado.

Fora de escopo (Fase 4b): CRUD de orçamento por categoria, alerta de
orçamento ultrapassado, alerta de variação histórica, card "Alertas de
orçamento" (permanece placeholder).

## Navegação entre meses

Estado do mês selecionado vive na URL como query params `?ano=YYYY&mes=M`
em todas as páginas do dashboard (`/dashboard`, `/dashboard/gastos`,
`/dashboard/receitas`, `/dashboard/saldo`). Sem parâmetros, assume o mês
atual. Um header de navegação reutilizável (`components/month-nav.tsx`)
renderiza "‹ Mês Ano ›" e monta os links `prev`/`next` preservando a rota
atual. Usar query params (em vez de estado de cliente) mantém a página
como server component, permite bookmarkar/compartilhar um mês específico,
e evita duplicar lógica de mês entre as 4 páginas.

## Camada de dados

`lib/dashboard.ts`:

- `listTransactionsForMonth(supabase, userId, year, month): Promise<TransactionRow>` —
  busca transações do usuário com `occurred_on` dentro do mês
  (join implícito com `categories` para trazer o nome da categoria).
- `buildMonthSummary(transactions, categories): MonthSummary` — função
  pura que recebe as transações já carregadas e retorna:
  ```ts
  {
    saldo: number;
    receitas: number;
    gastos: number;
    porCategoria: { categoryId: string | null; categoryName: string; total: number }[];
  }
  ```
  Transações sem categoria entram em um grupo "Sem categoria".
  `porCategoria` só soma transações de saída (gastos), ordenada por
  total decrescente.

Separar busca (`listTransactionsForMonth`, impura) de cálculo
(`buildMonthSummary`, pura) segue o padrão já usado em
`lib/categorization.ts` / `lib/category-rules.ts` e permite testar o
cálculo com fixtures sem precisar de banco.

## Páginas

### `app/dashboard/page.tsx` (server component)

1. `<MonthNav />` no topo.
2. 3 `Card` de resumo (saldo, receitas, gastos) com valores reais de
   `buildMonthSummary`, mantendo os links para as páginas de detalhe
   (agora passando `?ano=&mes=` do mês atualmente selecionado).
3. Card "Gastos por categoria": renderiza `<CategoryDonutChart data={porCategoria} />`,
   um client component (`components/category-donut-chart.tsx`) usando
   `recharts` `PieChart`/`Pie` com `innerRadius` para o efeito donut.
   Estado vazio (nenhum gasto no mês) mostra o placeholder atual.
4. Card "Alertas de orçamento": placeholder inalterado (Fase 4b).

### `app/dashboard/gastos/page.tsx`, `receitas/page.tsx`, `saldo/page.tsx`

Server components. Reutilizam `listTransactionsForMonth` filtrando por
`direction` (`gastos` → saida, `receitas` → entrada, `saldo` → ambos).
Renderizam `<MonthNav />` + tabela (data, descrição, categoria, valor)
em estilo consistente com `review-table.tsx`. Estado vazio: mensagem
"Nenhuma transação neste mês."

## Dependência nova

`recharts` — biblioteca de gráficos React, usada apenas no client
component do donut. Sem outras dependências novas.

## Testes

`lib/dashboard.test.ts` (vitest), cobrindo `buildMonthSummary`:

- mês sem transações → todos os totais zero, `porCategoria` vazio.
- mistura de entrada/saída → saldo, receitas, gastos corretos.
- transações sem `category_id` → agrupadas em "Sem categoria".
- múltiplas transações na mesma categoria → soma corretamente e
  ordena `porCategoria` por total decrescente.

Sem testes de integração/e2e novos — mesmo padrão já usado no projeto.
