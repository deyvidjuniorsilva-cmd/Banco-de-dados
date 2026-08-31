# Fase 4b — Orçamento, Previsão e Sugestões de Economia — Design

## Visão geral

Extensão do dashboard existente (Fase 4a) com três capacidades novas:

1. **Orçamento manual por categoria** — usuário define um valor limite
   mensal por categoria (funcionalidade já prevista no design original,
   ainda não implementada).
2. **Previsão de gastos do próximo mês** — o sistema estima quanto será
   gasto em cada categoria no mês seguinte, com base no histórico.
3. **Sugestões de economia** — ranking das categorias onde reduzir o
   gasto geraria mais economia, com base na previsão e no melhor mês
   recente.

Tudo entra na página de Dashboard já existente, como blocos novos
abaixo do que já está lá — sem página separada.

## Modelo de dados

Nenhuma tabela nova. A tabela `budgets` (categoria, mês/ano, valor
limite) já existe desde a Fase 1 e está sem uso — esta fase é quem
finalmente lê e escreve nela.

Previsão e sugestões são calculadas em tempo de requisição a partir de
`transactions` + `budgets`; não são persistidas.

## Orçamento por categoria (CRUD)

- Lista de categorias com input de limite mensal, edição inline, sem
  tela separada.
- Cada linha: nome da categoria, gasto atual do mês, limite (editável),
  barra de progresso gasto/limite.
- Destaque visual (cor de alerta) quando gasto atual ultrapassa o
  limite, ou fica a menos de 10% dele.
- Salvar limite grava/atualiza a linha em `budgets` para o par
  categoria + mês/ano corrente. Definir o limite de um mês não afeta
  meses anteriores nem futuros — cada mês tem sua própria linha,
  criada sob demanda quando o usuário define um valor.

## Alerta por variação histórica

Mantido do design original: para cada categoria, calcula a média dos
últimos N meses (N=3, fixo) e sinaliza quando o gasto do mês atual está
>30% acima dessa média — mesmo sem orçamento definido para a categoria.
Esse alerta é independente do orçamento manual e aparece junto na
mesma lista de categorias.

## Previsão do próximo mês

Para cada categoria com dados suficientes:

```
previsao_proximo_mes = média do gasto dessa categoria
                        nos últimos N meses (N=3)
```

- Categorias com menos de 2 meses de histórico ficam de fora da
  previsão e aparecem marcadas como "histórico insuficiente" — não
  entram no ranking de sugestões também.
- Exibida em cards por categoria: previsão vs. orçamento definido
  (quando existir), com destaque se a previsão já ultrapassa o limite.
- Meses sem nenhuma transação em uma categoria contam como gasto zero
  no cálculo da média (não são excluídos do denominador).

## Sugestões de economia

Ranking das categorias variáveis com maior potencial de corte:

```
potencial_economia = previsao_proximo_mes - menor_gasto_mensal
                      dentre os últimos N meses da categoria
```

- Só entram categorias com previsão calculada (histórico suficiente) e
  `potencial_economia > 0`.
- Mostra as 3 a 5 categorias com maior potencial, ordenadas
  decrescente.
- Frase por item: "Reduzindo <categoria> para o nível do seu melhor
  mês recente (R$X), você economiza R$Y."
- Se nenhuma categoria tiver potencial de economia positivo, o bloco
  mostra uma mensagem neutra ("Nenhuma categoria com corte óbvio este
  mês") em vez de lista vazia sem explicação.

## Layout no Dashboard

Três blocos novos, na ordem, abaixo do resumo do mês e do gráfico de
categorias já existentes:

1. Orçamento por categoria (CRUD + alertas de limite/histórico)
2. Previsão do próximo mês
3. Sugestões de economia

## Testes

- Cálculo de média móvel: casos normais, histórico insuficiente (0 ou 1
  mês), mês com gasto zero incluído no denominador.
- Cálculo de potencial de economia e ranking: ordenação, empate,
  nenhuma categoria com potencial positivo, categoria fora do ranking
  por histórico insuficiente.
- CRUD de orçamento: criar limite pela primeira vez no mês, editar
  limite existente, limite de um mês não vaza para outro mês.
- Alerta de limite e de variação histórica: casos de borda (exatamente
  no limite, exatamente em 30% de variação).

## Fora de escopo (mantido do design original)

- Detecção de despesas fixas/recorrentes separadas de variáveis.
- Parcelas futuras de cartão já conhecidas somadas à previsão.
- Meta de economia definida pelo usuário com redistribuição
  proporcional entre categorias.
- Conciliação automática entre extrato e lançamentos externos (tema do
  sub-projeto do agente de WhatsApp, tratado em spec separada).
