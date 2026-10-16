# Hermes — Central de Relatórios e Dados (documento de planejamento)

> Este documento é uma especificação técnica para implementação futura. Nenhum código, schema ou
> dependência descrita aqui foi implementado ou instalado nesta rodada.

---

## 0. Contexto — decomposição do pedido original

O pedido original do usuário cobria três subsistemas independentes:

1. **Central de relatórios e dados** (este documento) — mais comparações, gráficos de verdade,
   exportação, visão por conta.
2. **IA local / predição estatística de gastos** — depende dos agregados produzidos por (1).
3. **Integração com Telegram + OCR** (canal de entrada para registrar contas por mensagem/foto) —
   independente de (1) e (2); há um spec quase idêntico já pronto para WhatsApp em
   `docs/whatsapp-integration.md`, a ser adaptado.

Ordem de implementação acordada com o usuário: (1) → (2) → (3). Este documento cobre apenas (1).

---

## 1. Objetivo

Hoje `/reports` (via `GetSpendingReportUseCase`) já produz: fluxo de caixa mensal, patrimônio ao
longo do tempo, gastos por categoria, orçamentos, comparação com o período imediatamente anterior
e participação de despesas recorrentes na renda — tudo renderizado com barras CSS feitas à mão.

Este documento amplia essa central com:

- gráficos de verdade (linha/barra/pizza), mantendo a estética "ficha/papel" do Hermes;
- comparações adicionais: ano a ano (YoY), mesmo mês do ano anterior, média/mediana/tendência por
  categoria, série por conta ao longo do tempo;
- exportação em CSV e PDF.

**Fora de escopo nesta rodada:** tags/etiquetas — não existem como conceito no domínio hoje
(confirmado: nenhuma entidade, migration ou campo de tag em `src/core` ou `src/infra/database`).
Adicionar tags é uma feature própria (nova entidade, migration, UI de atribuição nas transações),
maior que "central de relatórios". Visão por **conta** entra porque `Account` já é uma entidade
existente — é só um novo corte sobre dados já modelados.

---

## 2. Arquitetura — camada de calculators isolados

`GetSpendingReportUseCase` tem hoje 332 linhas com 6 cálculos como métodos privados de uma única
classe. Dobrar esse padrão com as 4 métricas novas tornaria a classe difícil de testar e,
criticamente, difícil de reaproveitar quando o subsistema de IA (item 2 da decomposição) precisar
dos mesmos agregados — ele não deve ter que importar o monólito inteiro nem duplicar lógica.

**Decisão:** extrair cada métrica para uma função pura em
`modules/reports/application/metrics/`. Cada `calculate-*.ts` recebe dados já carregados
(`transactions`, `accounts`, `categories` — arrays, não repositórios) e devolve sua fatia do
relatório. Sem `async`, sem acesso a repositório, testável sem mock de banco.

```
modules/reports/application/
  metrics/
    calculate-cash-flow.ts                (extrai lógica já existente, sem mudança de comportamento)
    calculate-category-spending.ts        (idem)
    calculate-category-comparison.ts      (idem)
    calculate-recurring-expense-share.ts   (idem)
    calculate-net-worth-by-month.ts        (idem)
    calculate-account-series.ts           [novo]
    calculate-year-over-year.ts           [novo]
    calculate-same-month-last-year.ts     [novo]
    calculate-trend-stats.ts              [novo]
  get-financial-report.use-case.ts        (renomeia GetSpendingReportUseCase; orquestra: busca
                                            dados 1x, chama cada calculator, monta o objeto de saída)
```

O use case orquestrador mantém a responsabilidade atual de buscar dados via repositórios
(`AccountRepository`, `TransactionRepository`, `BudgetRepository`, `CategoryRepository`,
`RecurringTransactionRepository`) e delega todo cálculo aos módulos em `metrics/`. Isso respeita a
regra de dependência do projeto (`docs/architecture.md`): `core`/cálculo nunca depende de
infraestrutura, e a extração não muda nenhum comportamento das 6 métricas já existentes — só move
onde o código vive.

---

## 3. Métricas novas

### 3.1 Série por conta (`calculate-account-series`)

Para cada conta visível (`!account.hidden`): série mensal de saldo (mesma lógica de reconstrução
retroativa já usada em `calculate-net-worth-by-month`, aplicada a uma conta por vez em vez do
total consolidado) + série mensal de receita/despesa daquela conta (reuso de
`buildMonthlyCashFlow` filtrando por `accountId` antes de agregar).

```ts
interface AccountSeries {
  accountId: string;
  accountName: string;
  balanceByMonth: NetWorthPoint[];
  cashFlowByMonth: MonthlyCashFlow[];
}
```

Segue o seletor de período (`from`/`to`) já existente na tela — mesmo intervalo usado pelo
patrimônio consolidado hoje, não uma janela própria.

### 3.2 Ano a ano — YoY (`calculate-year-over-year`)

Compara o ano civil corrente **até hoje** (1º de janeiro até a data atual) com o mesmo intervalo
do ano anterior (1º de janeiro até o mesmo dia-do-ano) — nunca ano completo vs. ano parcial, para
a comparação ser justa em qualquer mês do ano. Total geral (receita/despesa) + por categoria, com
`deltaPercent` seguindo o mesmo padrão de `null` quando o valor anterior é zero (já usado em
`CategoryComparison`).

### 3.3 Mesmo mês ano passado (`calculate-same-month-last-year`)

Compara o mês civil que contém `period.to` com o mesmo número de mês no ano anterior (ex:
outubro/2026 vs outubro/2025). Total geral + por categoria. Mesma convenção de `deltaPercent`.

### 3.4 Média / mediana / tendência (`calculate-trend-stats`)

Por categoria de despesa, sobre a série mensal de totais: média, mediana, e uma direção de
tendência (`'subindo' | 'caindo' | 'estável' | 'insuficiente'`) via inclinação de regressão linear
simples sobre os totais mensais. `'insuficiente'` quando há menos de 2 meses com dado — nunca
tentar regressão sobre 0 ou 1 ponto. Estatística descritiva pura; nenhum modelo de IA/ML entra
aqui (isso é o próximo subsistema da decomposição, item 2).

Também segue o seletor de período da tela (mesma série mensal usada no fluxo de caixa) — se o
usuário estreitar o período a ponto de sobrar menos de 2 meses de dado, o resultado é
`'insuficiente'` em vez de um número sem sentido estatístico.

### 3.5 Âncora temporal

YoY e "mesmo mês ano passado" **não seguem** o seletor de período (`from`/`to`) já existente na
tela — são sempre ancorados em "hoje"/ano civil atual, numa seção própria da UI ("Comparações").
O seletor de período continua controlando as métricas que já existem hoje (fluxo de caixa,
patrimônio, categoria, orçamentos).

---

## 4. Gráficos

Trocar as barras CSS manuais por **Recharts**, através de um wrapper fino (padrão shadcn/ui
chart) que lê as mesmas CSS vars que o projeto já define para status/ênfase (`--success`,
`--destructive`, `--warning`, `--primary`) em vez da paleta padrão do Recharts — preserva a
estética "ficha/papel" (`registration-frame`, `dimension-figure`, `font-display`) descrita em
`docs/ui-ux.md`, em vez de importar a aparência genérica de dashboard de BI.

Cobre os três tipos de gráfico necessários com uma única biblioteca: linha (patrimônio, série por
conta), barra (receita vs. despesa mensal) e pizza/doughnut (gastos por categoria). Novo wrapper
em `src/components/ui/chart.tsx` (ou equivalente), consumido pelas seções da página.

Sem dados suficientes → mesmo empty-state textual já usado hoje ("Sem dados suficientes para este
período."), nunca renderizar um gráfico vazio.

---

## 5. Exportação

- **CSV** — reusa `buildCsv` (`@/shared/lib/csv`) e o padrão de rota já usado em
  `/api/transactions/export/route.ts` (mesma guarda de autenticação, mesmo BOM UTF-8 para Excel,
  mesmo teto `EXPORT_MAX_ROWS`). Nova rota: `/api/reports/export?format=csv&...` reaproveitando os
  mesmos query params de período já usados por `/reports`. **Zero dependência nova.**
- **PDF** — dependência nova: **`@react-pdf/renderer`**. Gera o PDF via componentes React no
  servidor (Node), sem navegador headless — Puppeteer seria desproporcional para um relatório
  tabular/gráfico simples. Mesma rota, `?format=pdf`.

---

## 6. Layout da UI

`/reports` passa a ter abas dentro da mesma página — não rotas separadas (no volume de dados de
uso pessoal, multiplicar rotas não paga seu custo de navegação extra frente a abas numa única
página):

- **Visão geral** — o que já existe hoje (fluxo de caixa, patrimônio, categoria, orçamentos,
  recorrências), agora com gráficos Recharts em vez de barras CSS.
- **Por conta** — série nova (§3.1).
- **Comparações** — YoY, mesmo mês ano passado, tendências (§3.2–3.4).

Botões de exportar (CSV/PDF) fixos no topo da página, exportando a aba ativa.

---

## 7. Tratamento de erro

- `deltaPercent: null` quando o valor do período/ano anterior é zero — nunca dividir por zero
  (mesma convenção já usada em `CategoryComparison`).
- Tendência com menos de 2 pontos mensais → `'insuficiente'`, nunca regressão sobre 0/1 ponto.
- Conta sem transações no período → mesmo empty-state textual já usado hoje.
- Rotas de exportação → mesma guarda de 401 das rotas existentes; mesmo teto de linhas.

---

## 8. Testes

- Cada `calculate-*.ts` ganha teste unitário puro (sem mock de repositório): caso típico, período
  anterior zerado (`deltaPercent: null`), sem dados (lista vazia), e para `calculate-trend-stats`
  especificamente o caso de menos de 2 meses de dado (`'insuficiente'`).
- `GetFinancialReportUseCase` (orquestrador) ganha teste de integração leve com os fakes já
  existentes em `src/tests/fakes/` — verifica que ele busca os dados e repassa a cada calculator
  corretamente, no padrão de `get-spending-report.use-case.test.ts` já existente.
- Rotas de exportação (`/api/reports/export`) ganham teste de 401 (não autenticado) e de
  content-type/shape da resposta, no padrão dos testes de route handler já existentes no projeto.
- Nenhum teste novo para `page.tsx` — segue a convenção atual do projeto, onde páginas
  server-component não são testadas diretamente, só os use cases que elas chamam.

---

## 9. Fora de escopo desta rodada

- Tags/etiquetas (ver §1) — feature própria, documentar como melhoria futura separada se o usuário
  quiser retomar.
- Qualquer modelo de IA/ML ou predição — é o subsistema 2 da decomposição (§0), consome os
  calculators deste documento, mas não é implementado aqui.
- Integração com Telegram/OCR — subsistema 3 da decomposição (§0), independente deste documento.
- Relatórios agendados/enviados por e-mail ou mensagem — não solicitado nesta rodada.

---

## 10. Critério de pronto para uma futura implementação

1. Extrair as 6 métricas já existentes de `GetSpendingReportUseCase` para funções puras em
   `modules/reports/application/metrics/`, sem alterar comportamento (testes atuais continuam
   passando inalterados).
2. Renomear `GetSpendingReportUseCase` → `GetFinancialReportUseCase`, mantendo-o como orquestrador
   fino.
3. Implementar as 4 métricas novas (§3) como calculators, com seus testes unitários.
4. Adicionar `recharts` como dependência e criar o wrapper temático em `src/components/ui/chart.tsx`
   (ou equivalente), substituindo as barras CSS manuais na aba "Visão geral".
5. Implementar a aba "Por conta" e a aba "Comparações" na página `/reports`.
6. Adicionar `@react-pdf/renderer` como dependência; implementar
   `/api/reports/export/route.ts` com `?format=csv|pdf`, reaproveitando `buildCsv` para o CSV.
7. Testes: calculators (unitários), use case orquestrador (integração com fakes), rota de export
   (401 + shape da resposta).
