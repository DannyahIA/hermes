# Hermes — Rodada 3: Relatórios que respondem perguntas, dashboard interativo, empty states, microcopy

> Spec arquitetural. Terceira e última rodada planejada do pedido original do usuário (2026-08-20).
> Cobre os itens #11 (relatórios), #12 (dashboard interativo), #13 (empty states) e #14
> (microcopy). As Rodadas 1 (fundação da listagem de transações) e 2 (saldo atual, parcelamento
> flexível, importação com preview, preferências de visualização) já estão concluídas.

## 1. Relatórios que respondem perguntas

`/reports` e `GetSpendingReportUseCase` já existem (construídos numa rodada anterior desta mesma
sessão): fluxo de caixa por mês, gastos por categoria, evolução patrimonial, visão geral de
orçamentos. Esta rodada adiciona o que ainda falta — comparação entre períodos e a relação entre
gastos recorrentes e renda — sem alterar o que já existe.

### Comparação mês a mês por categoria

`GetSpendingReportUseCase.execute()` passa a buscar também os dados do período imediatamente
anterior, de mesma duração (`previousPeriod = { from: shiftBack(period), to: period.from }`), e
retornar:

```ts
export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  currentTotal: number;
  previousTotal: number;
  /** null quando previousTotal é 0 (divisão por zero não faz sentido — a
   * categoria é nova neste período, não "cresceu X%"). */
  deltaPercent: number | null;
}
```

Adicionado a `SpendingReport` como `categoryComparison: CategoryComparison[]`, ordenado por
`currentTotal - previousTotal` decrescente — a pergunta "qual categoria mais cresceu?" é
literalmente a primeira posição dessa lista.

### Gastos recorrentes como % da renda

Toda regra de recorrência ativa nesta aplicação já é mensal por design (`dayRuleKind` é sempre
"todo dia X" / "primeiro dia útil" / "último dia útil" do mês — não existem recorrências semanais
ou anuais). Isso torna o cálculo direto: soma das regras ativas de despesa dá o compromisso mensal
recorrente, sem precisar normalizar por período.

```ts
export interface RecurringExpenseShare {
  monthlyRecurringExpense: number;
  averageMonthlyIncome: number;
  /** null quando averageMonthlyIncome é 0 — sem renda no período, a
   * pergunta "que % da renda" não tem resposta. */
  percentage: number | null;
}
```

`averageMonthlyIncome = totalIncome / mesesNoPeríodo`. `monthlyRecurringExpense` vem de uma nova
consulta a `RecurringTransactionRepository.findByUserId(userId)`, filtrando `active && type ===
'expense'` e somando `amount`. Adicionado a `SpendingReport` como `recurringExpenseShare`.

### UI (`/reports`)

- Nova seção "Comparação com o período anterior": lista as 5 categorias com maior crescimento em
  valor absoluto (não percentual — uma categoria que foi de R$2 para R$20 "cresceu 900%" mas é
  irrelevante comparada a uma que foi de R$500 para R$800), com o Δ% ao lado quando definido.
- Card "Gastos recorrentes": mostra `monthlyRecurringExpense`, `averageMonthlyIncome` e o
  percentual, com uma barra de progresso simples (mesmo padrão visual de `budget-progress-card.tsx`)
  — útil para a pergunta do pedido original: "quanto meus gastos recorrentes representam da minha
  renda?".

## 2. Dashboard interativo

O gráfico de fluxo de caixa já existe (`dashboard/page.tsx`, barras de receita/despesa por mês,
construídas à mão, sem biblioteca). Esta rodada adiciona apenas a interação de clique — a seleção
de intervalo por arraste ("brush select", estilo DevTools Network) continua fora de escopo, uma
decisão já tomada na Rodada 1 e mantida aqui.

Cada barra individual (receita ou despesa de um mês) vira um `<Link>` para
`/transactions?from={inícioDoMês}&to={fimDoMês}&type={income|expense}` — a mesma URL que os
filtros de `/transactions` já entendem (Rodada 1). Clicar em "Despesas → Junho" leva à lista
filtrada exatamente das transações que compõem aquele valor — a pergunta "o que compõe esse valor
do gráfico?" do pedido original, respondida sem nenhuma view nova, só reaproveitando o filtro que
já existe.

**Antes de escrever qualquer marcação de gráfico nesta rodada, a skill `dataviz` deve ser carregada
e seguida** — mesma exigência já aplicada na rodada de relatórios anterior desta sessão.

## 3. Empty states

A maioria das telas já tem algum tratamento de estado vazio ("Nenhuma conta cadastrada." + um
CTA) — isso é consolidação, não construção do zero. Um componente `EmptyState` reutilizável
(`src/components/ui/empty-state.tsx`) padroniza título, descrição e CTA num único lugar, e é
aplicado às telas que hoje têm tratamento inconsistente ou ausente (confirmado por auditoria antes
da implementação: `/reports` sem orçamentos, `/loans`, `/categories`).

Tratamento visual "fantasma" (prévia transparente de como a tela fica com dados) fica restrito ao
hero do dashboard quando o usuário não tem nenhuma conta — é o ponto de maior valor (primeira tela
que um usuário novo vê) e generalizar isso para toda tela inflaria o escopo desproporcionalmente
ao pedido original, que já classificava isso como algo a "considerar", não um requisito rígido.

## 4. Microcopy

Textos curtos (uma frase) explicando o propósito de funcionalidades menos óbvias, adicionados
diretamente onde já existem `CardDescription`/textos de apoio — sem novos componentes, sem
tutoriais. Telas alvo: `/budgets` ("Defina quanto pretende gastar em cada categoria e acompanhe seu
progresso ao longo do mês" — texto já sugerido pelo próprio pedido original), a seção de
recorrências em `/transactions` (já tem uma descrição curta desde a Rodada F — só uma revisão de
clareza, não uma reescrita), `/loans` (explicar a diferença entre compra parcelada e empréstimo,
já que a UI trata os dois de forma unificada).

## Fora de escopo desta rodada

- Seleção de intervalo por arraste no gráfico do dashboard (decisão já tomada na Rodada 1).
- Empty state "fantasma" em outras telas além do hero do dashboard.
- Qualquer nova biblioteca de gráficos — a skill `dataviz` já orientou nas rodadas anteriores para
  manter gráficos feitos à mão, consistente com "menos dependências".

## Verificação

- Testes unitários: `GetSpendingReportUseCase`'s cálculo de `categoryComparison` (categoria nova
  no período atual → `deltaPercent: null`; categoria que zerou → aparece com `currentTotal: 0`;
  ordenação por delta absoluto correta) e `recurringExpenseShare` (soma correta de regras ativas
  de despesa; `percentage: null` quando não há renda no período; múltiplas contas/categorias).
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `vitest run` — todos verdes.
- Manual: clicar numa barra de despesa de um mês no dashboard e confirmar que `/transactions`
  abre já filtrado pelo mês e tipo corretos; conferir que a lista de "categorias que mais
  cresceram" bate com uma verificação manual simples (duas categorias, valores conhecidos);
  esvaziar uma conta de teste (arquivar todas) e confirmar que o dashboard mostra o estado vazio
  com CTA, não um erro.
