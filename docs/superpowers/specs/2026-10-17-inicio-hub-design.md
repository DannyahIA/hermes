# Hermes — Início: a prancha do dia (documento de planejamento)

> Especificação para implementação futura. Nenhum código, schema ou dependência descrita aqui foi
> implementado nesta rodada. Base: leitura do código em `main` (`314f91e`) e capturas da tela atual
> com o usuário demo, em 17/10/2026, a 1440 px e 390 px.

---

## 0. Diagnóstico da tela atual

O dashboard responde "quanto tenho" com um número que está errado para quem usa cartão de
crédito, e deixa sem resposta as perguntas que surgem no dia a dia. Em ordem de gravidade:

### 0.1 Números errados (corrigir antes de qualquer redesenho)

1. **O patrimônio soma a dívida do cartão como se fosse dinheiro.** `GetDashboardSummaryUseCase`
   soma o `currentBalance` de todas as contas visíveis. Para `type: 'credit'` esse saldo é o que
   se deve (`Account.deltaFor`: despesa no cartão _aumenta_ o saldo). Cada R$ 100 gastos no cartão
   aumentam o patrimônio em R$ 100, em vez de diminuir. O mesmo erro está em
   `calculateNetWorthByMonth`, que alimenta Relatórios e o PDF (`R.01`, `R.02`).
2. **O pagamento da fatura é contado como despesa uma segunda vez.**
   `PayCreditCardBillUseCase` grava uma `expense` sem categoria na conta corrente ("Pagamento de
   fatura"), e as compras feitas no cartão já foram registradas como `expense`. Toda compra no
   crédito entra duas vezes em "Despesas do mês", no fluxo de caixa, nos relatórios e no balde
   "Sem categoria". Para quem paga quase tudo no crédito, isso dobra o gasto do mês.

Os dois erros crescem com o uso do cartão. Como a captura do Apple Pay
(`2026-10-17-telegram-apple-pay-design.md`) vai registrar cada compra no crédito
automaticamente, eles precisam estar corrigidos antes dela.

### 0.2 Informação que falta ou não serve

3. **Orçamentos sem nome.** Cada linha mostra só o valor e o percentual
   (`R$ 1.800,00 · 17%`), sem dizer de qual categoria é.
4. **Nada sobre o cartão.** Não aparece fatura aberta, fechamento nem vencimento, embora o domínio
   tenha `closingDay`, `dueDay` e `Account#nextDueDate`.
5. **Os "compromissos futuros" só mostram parcelas.** Parcelas são materializadas como transações
   futuras; recorrências (aluguel, assinaturas, salário) só são geradas quando vencem
   (`GenerateDueOccurrencesUseCase`), então nunca aparecem com antecedência.
6. **O fluxo de caixa de 6 meses** usa barras CSS sem valores nem eixo. A legenda expõe vocabulário
   interno ("traço azul", "redline"). É histórico, e o lugar dele é Relatórios.
7. **Últimas transações** não mostram conta nem categoria. Lançamentos só com data imprimem "00:00".
   No celular, o sinal "−" quebra a linha e fica separado do valor.

### 0.3 Transações e acabamento

8. **Transações no desktop:** os filtros ficam espremidos numa coluna estreita
   ("Todas as categori"), o nome da conta fica desalinhado abaixo da descrição, e as recorrências
   ocupam uma coluna fixa.
9. **Transações no celular:** sete controles (três atalhos de período, três selects, duas datas e
   três botões) aparecem antes da primeira transação, que só surge depois de cerca de 650 px.
10. **Sidebar:** o nome "Hermes" ao lado do "H" fica quase invisível no tema claro (texto escuro
    sobre o azul-marinho).

---

## 1. Objetivo

A tela inicial deve responder, nesta ordem, as perguntas de quem paga quase tudo por aproximação
no cartão de crédito:

1. **Quanto ainda posso gastar até o próximo recebimento?** O valor total e por dia.
2. **Quanto devo no cartão, quando fecha e quando vence?**
3. **O que preciso revisar?** Gastos que entraram sem categoria, como as capturas do Apple Pay.
4. **Estou no ritmo dos orçamentos?** Não só "quanto gastei", mas comparado com o quanto do mês já
   passou.
5. **O que vem por aí nos próximos 30 dias?** Contas, parcelas, faturas e entradas.
6. **O que aconteceu agora há pouco?**
7. **Como está meu patrimônio?** O valor correto, com a tendência e um link para Relatórios.

Correspondência com as perguntas de `docs/ui-ux.md`:

| ui-ux.md                        | Onde a tela nova responde                                                      |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Quanto tenho?                   | Cabeçalho: patrimônio. A versão que serve para gastar é o "Livre".             |
| Quanto gastei? / Quanto recebi? | Cabeçalho: gasto e recebido no mês, comparados com o mesmo dia do mês passado. |
| Estou dentro do orçamento?      | Seção Orçamentos, com ritmo.                                                   |
| Como evoluíram minhas finanças? | Patrimônio com tendência de 6 meses e link para Relatórios.                    |

---

## 2. Conceito

**A prancha do dia.** É a mesma linguagem Prancheta do app e do PDF: uma folha técnica,
cotas, linhas de construção e números em fonte mono.

- **O elemento-assinatura é uma cota encadeada do dinheiro em conta**, a mesma ideia da cota do
  "Resultado do período" no PDF. Uma barra única representa o saldo em conta corrente e é dividida
  em três trechos cotados, que somam o todo: _Cartões_ (o que já devo), _A pagar até [data]_ (o
  que está agendado) e _Livre_. Em desenho técnico, uma cota encadeada mostra exatamente partes
  consecutivas que somam uma medida total.
- **Todo o resto fica quieto:** linhas finas, linhas tracejadas entre itens (`dimension-row`),
  números em mono (`dimension-figure`) e nada de cards com sombra empilhados.
- **Cor só onde há significado** (tokens de `globals.css`):

  | Token                             | Significado                                         |
  | --------------------------------- | --------------------------------------------------- |
  | `primary` / `success` (blueline)  | Dinheiro, receita                                   |
  | `destructive` (redline)           | Dívida, despesa, estouro                            |
  | `warning` (amber)                 | Atenção: acima do ritmo, de 80% a 100% do orçamento |
  | Hachura diagonal na cor do trecho | "Agendado": ainda não aconteceu                     |

- **Texto sempre em tinta de texto,** nunca na cor do dado.
- **A direção nunca depende só da cor:** toda variação traz seta e sinal (↑ +12%), como no PDF.

---

## 3. Layout

### 3.1 Desktop (área de conteúdo ≥ 1024 px)

```
┌─ Início ───────────────────────────────────── [ almoço 32,50 crédito          ⏎ ] ─┐
│                                                                                     │
│  Livre até 05/11, dia do salário                    Recebido no mês  R$ 6.200,00   │
│  R$ 1.842,10                                         Gasto no mês     R$ 3.120,40   │
│  R$ 102 por dia nos próximos 18 dias                   ↓ R$ 410 vs. 17/set          │
│                                                      Patrimônio       R$ 268.410,20 │
│                                                                                     │
│  ├───────────────────── Em conta corrente  R$ 6.200,00 ──────────────────────────┤ │
│  ████████████████████▨▨▨▨▨▨▨▨▨▨▨▨░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
│  ├─ Cartões 2.900,00 ─┤├ A pagar 1.457,90 ┤├────── Livre 1.842,10 ──────┤          │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ Para revisar · 2 ──────────────────────────────┐ ┌─ Cartões ──────────────────────┐
│ Hoje 12:41  Padaria Real             R$ 23,90   │ │ Nubank              R$ 2.140,30│
│   Alimentação   Mercado   Lazer   Outra ▾       │ │ ├────────●──────────┤··········│
│ Ontem       Posto Shell             R$ 180,00   │ │ fechou 03/10  hoje  fecha 03/11│
│   Transporte   Carro   Outra ▾                  │ │ vence 10/11       Pagar fatura │
└─────────────────────────────────────────────────┘ └────────────────────────────────┘
┌─ Orçamentos ────────────────────────────────────┐ ┌─ Próximos 30 dias ─────────────┐
│ Mercado   R$ 1.240 de 1.800    Acima do ritmo   │ │ 20/10  Netflix          −55,90 │
│ ████████████████████░░░│░░░░░░░                  │ │ 25/10  Aluguel       −1.800,00 │
│ Lazer     R$ 310 de 600        No ritmo         │ │ 05/11  Salário       +6.200,00 │
│ ███████████░░░░░░░░░░░░│░░░░░░░                  │ │ 10/11  Fatura Nubank −2.140,30 │
│                        └ hoje: 55% do mês       │ │ Sai 3.996,20 · Entra 6.200,00  │
└─────────────────────────────────────────────────┘ └────────────────────────────────┘
┌─ Últimas transações ─────────────────────────────────────────────────── Ver todas ─┐
│ Hoje                                                                  −R$ 203,90   │
│   Padaria Real       Alimentação     Nubank Crédito                     −R$ 23,90  │
│   Posto Shell        Sem categoria   Nubank Crédito                    −R$ 180,00  │
│ Ontem                                                                 −R$ 64,00    │
│   …                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─ Patrimônio ────────────────────────────────────────────────────── Relatórios ─────┐
│ R$ 268.410,20   ↑ +R$ 1.204,10 vs. 30/set     ▁▂▂▃▃▅  (6 meses)                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Celular (390 px)

Em uma coluna, na ordem das perguntas (§1). Os rótulos da cota encadeada viram uma lista abaixo
da barra, porque os trechos ficam estreitos demais para rótulos sobre eles.

```
┌──────────────────────────────┐
│ ☰  Início                [+] │
│ [ almoço 32,50 crédito     ] │
├──────────────────────────────┤
│ Livre até 05/11              │
│ R$ 1.842,10                  │
│ R$ 102 por dia · 18 dias     │
│ █████████▨▨▨▨▨░░░░░░░░░░░░   │
│ ■ Cartões          2.900,00  │
│ ▨ A pagar até 05/11 1.457,90 │
│ □ Livre            1.842,10  │
│ ──────────────────────────── │
│ Gasto no mês   R$ 3.120,40   │
│   ↓ R$ 410 vs. 17/set        │
│ Patrimônio   R$ 268.410,20   │
├──────────────────────────────┤
│ Para revisar · 2             │
│ Cartões                      │
│ Orçamentos                   │
│ Próximos 30 dias             │
│ Últimas transações           │
│ Patrimônio (tendência)       │
└──────────────────────────────┘
```

O sinal e o valor ficam sempre juntos (`whitespace-nowrap`), resolvendo o item 7 do §0.

---

## 4. Seções

### 4.1 Livre até [horizonte] (cabeçalho)

**Definições:**

- **Horizonte (H):** a próxima ocorrência de uma receita recorrente ativa em conta corrente, dentro
  de 45 dias. Sem ela, o último dia do mês. O rótulo diz qual dos dois foi usado: "até 05/11, dia
  do salário" ou "até o fim do mês".
- **Em conta corrente (S):** a soma do saldo atual (`computeCurrentBalance`) das contas `checking`
  visíveis e não arquivadas. A poupança fica de fora, porque é reserva (decisão D1).
- **Cartões (C):** a soma de `max(0, saldo atual)` das contas `credit` visíveis, ou seja, a dívida
  de hoje: fatura fechada não paga mais a fatura aberta. O princípio é que gasto no crédito já é
  gasto hoje (decisão D2).
- **A pagar (P):** as despesas agendadas de hoje até H, em qualquer conta. Somam as transações
  futuras já materializadas (parcelas) e as ocorrências projetadas de recorrências de despesa,
  calculadas com `occurrencesToGenerate` sobre uma data futura, sem gravar nada.
- **Livre (L):** `S − C − P`.
- **Por dia:** `L ÷ dias até H`, com no mínimo 1 dia. Só aparece quando `L > 0`.

**Estados:**

| Situação               | O que a tela mostra                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `L > 0`                | O caso normal, descrito acima.                                                                                                                                                   |
| `L` entre 0 e 10% de S | Valor em tinta normal, com a frase "Apertado: R$ 21 por dia". O amber fica só no marcador da barra.                                                                              |
| `L < 0`                | "Você já comprometeu R$ 640,00 da próxima entrada", com o valor em redline. O trecho "Livre" some e a barra mostra o excesso como um trecho redline além da linha de cota total. |
| Sem conta corrente     | O cabeçalho mostra "Gasto no mês" como número principal e oferece o link "Cadastre sua conta corrente para ver quanto ainda pode gastar".                                        |

**Geometria da cota encadeada:**

- Reaproveita a lógica de `result-dimension.tsx` do PDF: trecho com menos de 18 px leva o rótulo
  por fora, com chamada (leader).
- Essa matemática deve ser extraída para uma função pura em `shared/lib/dimension-layout.ts`, usada
  pelo PDF e pela web, para os dois não divergirem.

**Acessibilidade:**

- O SVG é `aria-hidden`.
- Os três valores existem também como `<dl>` (visível no celular, `sr-only` no desktop).
- Cada trecho é um link:
  - Cartões → seção Cartões;
  - A pagar → Próximos 30 dias;
  - Livre → Transações do mês.

**Linha de apoio (coluna direita no desktop):**

- Recebido no mês.
- Gasto no mês, comparado com o mesmo dia do mês anterior ("↓ R$ 410 vs. 17/set"). O gasto
  já exclui o pagamento de fatura (§0, item 2).
- Patrimônio, já corrigido.

### 4.2 Para revisar

- **O que entra:** transações dos últimos 30 dias sem categoria. Isso inclui as capturas do Apple
  Pay e do Telegram que ainda não foram classificadas.
- **Como classificar:** cada linha traz até três categorias sugeridas, como botões de texto, e
  "Outra ▾" (um select com todas). Um toque salva com UI otimista, por server action sobre
  `UpdateTransactionUseCase`, e a linha sai da lista. Se der erro, a linha volta e aparece um
  toast: "Não foi possível salvar a categoria. Tente novamente."
- **De onde vêm as sugestões** (`suggestCategories`, função pura compartilhada com o Telegram):
  1. a categoria mais usada para a mesma descrição normalizada (sem acentos, caixa, números e
     sufixos como "LTDA");
  2. completando, as categorias de despesa mais usadas nos últimos 90 dias.
- **Escolher uma categoria ensina a regra:** grava `merchant_rules`, a tabela definida no spec do
  Telegram. Se esta fase vier antes, a tabela nasce aqui.
- **Fila vazia:** a seção não aparece. Uma fila vazia é o estado de sucesso, não uma página vazia.
- **Fila longa:** acima de 5 itens, mostra os 5 mais recentes e o link "Ver todas (12)", que abre
  Transações filtrada por "sem categoria".

### 4.3 Cartões

Um bloco por conta `credit` visível. Para cada um:

- **Valor principal:** a dívida atual.
- **Régua do ciclo:** uma linha com marcas no último fechamento, em hoje (●), no próximo
  fechamento e, tracejado, até o vencimento.
- **Duas linhas de texto:**
  - "Fatura aberta R$ 1.240,30 · fecha 03/11";
  - quando houver, "Fatura fechada R$ 900,00 · vence 10/10".
- **Ação "Pagar fatura":** reaproveita o diálogo que já existe em Contas (`pay-bill-dialog.tsx`).
- **Cálculo** (`calculateCardStatements`, função pura):
  - aberta = compras menos estornos no cartão, do último fechamento até hoje;
  - fechada não paga = `max(0, dívida − aberta)`, com vencimento no `dueDay` seguinte ao último
    fechamento;
  - hipótese documentada: pagamentos quitam primeiro a dívida mais antiga.
- **Sem cartão cadastrado:** a seção não aparece. O convite para cadastrar fica em Contas.
- **Fora de escopo:** o limite do cartão, que não existe no modelo (§9).

### 4.4 Orçamentos no ritmo

- **Cada linha mostra:** o nome da categoria (resolvendo o item 3 do §0), "R$ gasto de R$ limite",
  o medidor e o status em texto.
- **No medidor:** uma marca vertical indica o quanto do período do orçamento já passou, a mesma
  ideia da marca de cota.
- **Status:**

  | Status         | Regra                           | Cor da barra |
  | -------------- | ------------------------------- | ------------ |
  | No ritmo       | gasto% ≤ decorrido% + 10 pontos | blueline     |
  | Acima do ritmo | gasto% acima disso, e ≤ 100%    | amber        |
  | Estourado      | > 100%                          | redline      |

  O status é sempre escrito, não só colorido.

- **Ordem e limite:** Estourado, depois Acima do ritmo, depois por percentual. Mostra 5 e o link
  "Ver todos (n)" para Orçamentos.
- **Sem orçamento:** "Nenhum orçamento ainda. Crie um para acompanhar o ritmo de gastos." com o
  link "Criar orçamento".

### 4.5 Próximos 30 dias

- **Itens:**
  - recorrências projetadas, de despesa e de receita;
  - parcelas futuras;
  - vencimentos de fatura, com o valor da fatura fechada ou aberta conforme a data.
- **Agrupamento:** por data. Cada item mostra a data, a descrição, a conta e o valor com sinal.
- **Rodapé:** "Sai R$ X · Entra R$ Y".
- **Tamanho:** 8 itens e "Mostrar mais" expandindo no lugar.
- **Vazio:** "Nada agendado para os próximos 30 dias." com o link "Criar recorrência".

### 4.6 Últimas transações

- **Agrupamento:** por dia ("Hoje", "Ontem", "seg., 13 de out."), com o total do dia.
- **Cada linha:** descrição, categoria (ponto na cor da categoria e nome, ou "Sem categoria" como
  botão para classificar), conta e valor.
- **Horário:** aparece só quando não é meia-noite, o que acaba com o "00:00".
- **Tamanho:** 8 linhas e "Ver todas".
- **Origem:** uma marca discreta de texto ("Apple Pay", "Telegram", "Parcela 3/10", "Recorrente")
  quando a transação não foi lançada à mão.

### 4.7 Patrimônio

- **Conteúdo:** o valor corrigido (§0, item 1), a variação contra o fim do mês anterior com seta e
  sinal, e uma linha de 6 meses.
- **Gráfico:** a linha reaproveita `calculateNetWorthByMonth`, já corrigido. Desenho em Recharts,
  que já é dependência.
- **Link:** "Relatórios". Esta seção substitui o gráfico de fluxo de caixa (decisão D4).

### 4.8 Registro rápido

- **O campo:** uma linha no topo da tela que aceita o mesmo texto que o Telegram aceita:
  - "almoço 32,50 crédito";
  - "uber 18 débito";
  - "+3000 salário";
  - "mercado 250,40 ontem".
- **Prévia:** enquanto o usuário digita, aparece o que foi entendido, numa fileira de células
  rotuladas, como o carimbo de uma prancha sendo preenchido: Descrição, Valor, Tipo, Conta,
  Categoria e Data ("Hoje às 10:02"). Tipo, Conta e Categoria trocam ali mesmo, num select nativo
  sobre a célula. No desktop as células ficam numa linha, cada uma da largura do valor; no celular,
  em duas colunas.
- **Avisos:** "Falta o valor, como em almoço 32,50 crédito." bloqueia o registro. Com dois números
  e nenhum escrito como dinheiro ("2 cafés 9"), registra o último e avisa: "Usei R$ 9,00 como
  valor; 2 ficou na descrição."
- **Teclas:** Enter salva, Esc limpa. "Mais opções" abre o diálogo completo já preenchido.
- **Confirmação:** o campo limpa na hora e um toast diz "Registrado: Almoço, R$ 32,50", com a conta e
  a categoria, e o botão "Desfazer".
- **O parser:** `parseQuickEntry` (função pura) é o mesmo do Telegram. As regras de leitura estão
  em `docs/domain.md` (Registro rápido).

---

## 5. Transações (a página do extrato)

- **Barra de ferramentas única:**
  - busca por descrição;
  - atalhos de período (Hoje, 7 dias, Este mês, Mês passado, Personalizado);
  - botão "Filtros", que abre um painel com conta, categoria, tipo e datas;
  - filtros ativos como fichas removíveis, reaproveitando `filter-chips.tsx`;
  - ordenação;
  - um menu "Mais" com Transferência, Importar CSV e Exportar.
- **No celular:** a lista vem primeiro. A barra fica fixa e compacta: busca, Filtros e o período
  ativo. "Nova transação" continua no cabeçalho.
- **Linhas:**
  - colunas alinhadas (corrige o desalinhamento da conta);
  - categoria com ponto de cor;
  - conta com ícone do tipo (corrente, poupança, cartão);
  - valor em mono alinhado à direita;
  - horário oculto quando é 00:00.
- **Grupos por dia:** com o total do dia.
- **Sem categoria:** classificação no lugar, com o mesmo componente de "Para revisar".
- **Recorrências:** saem da coluna fixa e viram uma aba "Recorrências" na mesma página.

**Como ficou (F5):**

- **A "ordenação"** é o seletor que já existia ("Cronológico", "Por categoria", "Por mês"),
  agora "Agrupar: Por dia, Por mês, Por categoria", guardado por usuário como antes. "Por dia" é o
  padrão. Uma ordenação por valor exigiria outra paginação e ficou de fora.
- **Agendadas:** o extrato termina hoje. O que tem data depois (as parcelas futuras abriam a
  lista com meses à frente) fica num bloco recolhido no topo, com a quantidade, até quando vai e o
  total; abre sozinho quando o período escolhido só tem o que está agendado.
- **Totais:** cada dia, mês ou categoria mostra o total do grupo inteiro dentro dos filtros,
  calculado no banco (`TransactionRepository#totalsBy`), mesmo quando a lista ainda não carregou
  todas as linhas dele.
- **Rolagem:** 50 linhas por vez, sem virtualização: a lista rola com a página, o que deixa a barra
  fixa funcionar no celular. Depois de editar, excluir ou classificar uma linha, o servidor manda
  a primeira página de novo e o resto do que já estava carregado é buscado outra vez numa só
  requisição, sem a lista encolher.
- **Linhas:** uma linha por transação na lista larga e duas na estreita, conforme a largura da
  própria lista (container query), não a da tela. Editar e Excluir ficam num menu "…" por linha. A
  edição não apaga mais a hora de quem só trocou a descrição.
- **Barra:** no desktop, busca e "Filtros" numa linha e, abaixo, os atalhos de período (o ativo
  marcado; tocar de novo desfaz) e as fichas. No celular, busca, "Filtros" e um seletor de período,
  fixos no topo; "Agrupar" fica dentro de "Filtros".
- **Sem `loading.tsx`:** pelo mesmo motivo do Início (§6, Renderização). O esqueleto de
  carregamento da página foi removido; enquanto um filtro novo carrega, a lista atual fica
  esmaecida.

---

## 6. Arquitetura

Mesmo padrão adotado em Relatórios (`2026-10-16-financial-reports-center-design.md`, §2):
funções puras de cálculo e um caso de uso orquestrador fino.

```
core/value-objects/
  net-worth.ts                       [novo] patrimônio = caixa − dívida de cartão; único lugar
                                            da regra, usado pelo Início e por Relatórios
modules/dashboard/application/
  metrics/
    calculate-available-to-spend.ts  [novo] §4.1
    calculate-card-statements.ts     [novo] §4.3
    calculate-budget-pace.ts         [novo] §4.4
    calculate-upcoming.ts            [novo] §4.5 (projeta recorrências sem gravar)
    calculate-month-to-date.ts       [novo] gasto/recebido no mês vs. mesmo dia do mês anterior
    group-recent-by-day.ts           [novo] §4.6
modules/categories/application/
  suggest-categories.ts              [novo] §4.2 (compartilhado com o Telegram, por isso fora do
                                            módulo do Início)
  remember-merchant-category.ts      [novo] grava a regra do estabelecimento (Para revisar e
                                            registro rápido)
  get-category-suggestions.use-case.ts [novo] sugestões para as linhas sem categoria do extrato
modules/transactions/application/
  categorize-transaction.use-case.ts [novo] classifica e grava a regra do estabelecimento
  get-transaction-page.use-case.ts   [novo] §5: uma página do extrato, com o total de cada grupo
  get-scheduled-transactions.use-case.ts [novo] §5: o que tem data depois de hoje
  get-dashboard-summary.use-case.ts  (passa a orquestrar; também usa o repositório de
                                      recorrências e o de categorias)
shared/lib/
  dimension-layout.ts                [novo] geometria de cotas (PDF e web)
modules/capture/
  domain/
    normalize-merchant.ts            [novo] chave e nome limpo do estabelecimento (F3)
    parse-amount.ts                  [novo] valores em pt-BR; também lê o valor do atalho do iPhone
    parse-quick-entry.ts             [novo] §4.8 (compartilhado com o Telegram)
    merchant-memory.ts               [novo] o que já se sabe de cada estabelecimento: categoria,
                                            tipo, conta e grafia
    quick-entry-accounts.ts          [novo] contas que aceitam lançamento, com o uso de cada uma
  application/
    record-quick-entry.use-case.ts   [novo] registra a linha entendida e ensina a regra
```

**Correções de modelo (§0.1):**

- **Patrimônio:** a regra em `docs/domain.md` ("soma dos saldos das contas") passa a dizer
  explicitamente que o saldo de um cartão é passivo e entra subtraindo. `calculateNetWorthByMonth`
  passa a usar `net-worth.ts`.
- **Pagamento de fatura:** a transação passa a registrar qual cartão ela quita (novo campo
  opcional `settlesAccountId` em `transactions`, com migration). As métricas de receita e despesa
  ignoram transações com esse campo, mas o saldo da conta corrente continua sendo afetado. É
  preciso migrar os pagamentos já existentes: as transações com descrição "Pagamento de fatura" e
  sem categoria viram candidatas, com uma lista para o usuário confirmar. Esse vínculo a mais é a
  saída mínima que preserva a decisão já documentada no caso de uso, de que pagar fatura não é
  transferência nem par receita/despesa.

**Renderização:**

- Server Components.
- Sem `loading.tsx` nem `Suspense` em volta do conteúdo. No Next 16.2.10, com qualquer um dos
  dois, a re-renderização que uma Server Action devolve (`revalidatePath`) ou um
  `router.refresh()` nunca é aplicada: a transição fica pendente e a tela mostra os dados antigos
  até um reload. Isso quebrava "Pagar fatura" e "Nova transação" no Início desde antes deste
  redesenho, e quebraria a classificação com um toque. Rever ao atualizar o Next.
- Interatividade em ilhas cliente pequenas: registro rápido, classificação em "Para revisar" e
  "Mostrar mais".

---

## 7. Estados e casos de borda

| Caso                                     | Comportamento                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Usuário novo, sem contas                 | Mantém o fantasma atual da tela, atualizado para o novo layout, e a ação "Criar primeira conta". |
| Só cartão de crédito, sem conta corrente | Ver §4.1, "Sem conta corrente".                                                                  |
| Sem receita recorrente                   | Horizonte no fim do mês, com o rótulo dizendo isso.                                              |
| Livre negativo                           | §4.1.                                                                                            |
| 3 ou mais cartões                        | Os blocos de Cartões em grade de 2 colunas no desktop; no celular, um abaixo do outro.           |
| Nomes longos                             | Cortados com reticências e o nome inteiro em `title`. Nenhum valor é cortado.                    |
| Modo escuro                              | Mesmos tokens. A hachura usa `currentColor`, então funciona nos dois temas.                      |

---

## 8. Verificação (o mesmo rigor do PDF)

- **Testes unitários** para cada `calculate-*` e para `parseQuickEntry` (tabelas de casos). Devem
  incluir regressões para o sinal do cartão no patrimônio (Início e Relatórios) e para o pagamento
  de fatura fora das despesas.
- **Cenários de dados realistas.** Os dados demo atuais estão poluídos: 48 contas com 4 nomes e 46
  categorias com 2 nomes, restos de testes. Um script `pnpm db:seed:scenarios` cria um usuário por
  cenário:
  - `demo-tipico@`: salário recorrente, um cartão e orçamentos;
  - `demo-apertado@`: livre negativo;
  - `demo-novo@`: sem contas;
  - `demo-so-cartao@`;
  - `demo-muitos@`: muitas categorias e 3 cartões.
- **Capturas automáticas** com Playwright, a 1440 e 390 px, nos temas claro e escuro, para cada
  cenário. Revisão visual de colisões, quebras e cortes antes de dar cada fase por pronta.
- **Acessibilidade:** tudo operável por teclado, foco visível, contraste ≥ 4,5:1 nos textos e
  nenhum número que só exista dentro de um gráfico.
- **Antes de cada entrega:** `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm build`.

---

## 9. Fora de escopo

- Limite do cartão: não existe no modelo. Um futuro campo `creditLimit` permitiria mostrar o uso
  do limite.
- Metas de economia, investimentos e previsão de gastos por IA (subsistema 2 da decomposição de
  Relatórios).
- Notificações: estão no spec do Telegram.

---

## 10. Fases e critério de pronto

**F0 — Números certos e acabamento (pequena, prioridade máxima)**

1. Patrimônio subtrai a dívida do cartão, no Início, em Relatórios e no PDF, com teste de
   regressão.
2. Pagamento de fatura fora de receitas e despesas (`settlesAccountId`, migration e conversão dos
   pagamentos antigos), com teste de regressão.
3. Orçamentos com nome da categoria.
4. Legenda do fluxo de caixa sem vocabulário interno. Sem "00:00". Sinal e valor sempre juntos.
   Contraste do nome "Hermes" na sidebar.
5. `db:seed:scenarios` e o script de capturas.

**F1 — Cabeçalho "Livre"**

`calculate-available-to-spend`, `calculate-month-to-date`, a cota encadeada (web, com
`dimension-layout` extraído do PDF), os estados do §4.1, e linha de apoio.

**F2 — Cartões e Próximos 30 dias**

`calculate-card-statements` e `calculate-upcoming`, com a projeção de recorrências.

**F3 — Orçamentos no ritmo, Para revisar e Últimas transações**

`calculate-budget-pace` e `suggest-categories`. Classificação com um toque.

**F4 — Registro rápido**

`parseQuickEntry` e o campo com prévia.

**F5 — Página de Transações (§5)**

**Toda fase só termina quando:**

- os testes novos passam;
- as capturas dos 5 cenários foram revisadas a 1440 e 390 px, nos temas claro e escuro;
- não há regressão nas telas que já existem.

---

## 11. Decisões (com o padrão adotado se ninguém disser o contrário)

| #   | Pergunta                                                                                 | Padrão                                                                                                           |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| D1  | A poupança entra no "Livre"?                                                             | Não. É reserva. Aparece no patrimônio.                                                                           |
| D2  | A dívida inteira do cartão sai do "Livre", mesmo que a fatura vença depois do horizonte? | Sim. Gasto no crédito é gasto hoje. Se ficar negativo, a tela diz quanto da próxima entrada já foi comprometido. |
| D3  | Horizonte                                                                                | Próxima receita recorrente (até 45 dias), senão fim do mês.                                                      |
| D4  | O fluxo de caixa de 6 meses sai do Início?                                               | Sim. Fica em Relatórios. O Início mostra a tendência do patrimônio.                                              |
| D5  | O nome continua "Dashboard"?                                                             | O menu passa a dizer "Início". A rota `/dashboard` continua a mesma.                                             |
