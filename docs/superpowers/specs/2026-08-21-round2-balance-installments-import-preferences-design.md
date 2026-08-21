# Hermes — Rodada 2: Saldo atual, parcelamento flexível, importação com preview, preferências de visualização

> Spec arquitetural. Segunda de três rodadas planejadas para evoluir a UX/performance do app
> (contexto completo no pedido original do usuário, 2026-08-20). Esta rodada cobre os itens #10
> (saldo atual vs. projetado), #9 (parcelamento flexível), #6 (importação com preview/duplicidade,
> escopo priorizado — sem mapeamento manual de colunas) e #8 (preferências de visualização
> persistidas) do pedido. A Rodada 1 (fundação da listagem de transações) já está concluída.

## 1. Saldo atual vs. saldo projetado

### Diagnóstico

`CreateInstallmentPlanUseCase` materializa **todas** as N parcelas de uma compra parcelada ou
empréstimo como transações reais no momento da criação, e aplica o delta de saldo de cada uma
imediatamente (`account.withBalanceDelta(...)` dentro do loop, para cada parcela, inclusive as
futuras). Isso significa que `account.balance` — o valor armazenado e hoje exibido como "saldo" em
toda a aplicação — já inclui o efeito de compromissos que ainda não venceram. O exemplo do usuário
é exatamente esse caso: uma compra de 15 parcelas de R$165, na parcela 2, já tem as 13 parcelas
futuras deduzidas do saldo mostrado.

### Decisão de design

Não vamos alterar a materialização de parcelas (criar/editar/excluir parcelas continua exatamente
como está, já testado em rodadas anteriores). Em vez disso, tratamos o `balance` armazenado como o
que ele **já é de fato**: o saldo **projetado** (inclui todos os compromissos futuros conhecidos).
O **saldo atual** passa a ser um valor **derivado**, calculado subtraindo do saldo armazenado o
efeito de toda transação com `occurredAt` no futuro (posterior a "agora").

```
saldoAtual = saldoArmazenado - Σ(efeito de cada transação futura nesta conta)
saldoProjetado = saldoArmazenado  (sem mudança — é o que já existe hoje)
```

Isso é aditivo e de baixo risco: nenhuma mudança de schema, nenhuma mudança no fluxo de
criação/edição/exclusão de transações ou parcelas.

### `computeCurrentBalance` (`core/value-objects/`)

```ts
export function computeCurrentBalance(
  storedBalance: number,
  futureTransactions: Array<{
    type: 'income' | 'expense' | 'transfer';
    amount: number;
  }>,
  account: Pick<Account, 'deltaFor'>,
): number {
  const futureEffect = futureTransactions.reduce((sum, t) => {
    // Transfer legs don't carry a stored direction (see "Limitação conhecida"
    // below) — reversed the same way DeleteTransactionUseCase already does,
    // for consistency with existing (pre-Rodada-2) behavior.
    const delta =
      t.type === 'transfer' ? t.amount : account.deltaFor(t.type, t.amount);
    return sum + delta;
  }, 0);
  return storedBalance - futureEffect;
}
```

Pura, testável sem repositório — mesmo padrão de `core/value-objects/loan-amortization.ts`.

### Limitação conhecida (herdada, não introduzida por esta rodada)

Uma transferência é gravada como duas linhas de `Transaction` (`type: 'transfer'`), uma por conta,
sempre com `amount` positivo — não existe campo que diga qual perna é a de saída (débito) e qual é
a de entrada (crédito). `DeleteTransactionUseCase` já trata esse caso hoje revertendo sempre com
`+amount`, independente da direção — um comportamento pré-existente que este documento não tenta
corrigir (mudar isso exigiria adicionar um campo de direção ao schema, fora do escopo aprovado).
`computeCurrentBalance` segue a mesma convenção por consistência. Na prática, transferências
agendadas para o futuro são raras comparadas a parcelas/empréstimos, que são o caso real do pedido
do usuário e são calculados com 100% de precisão via `Account.deltaFor`.

### Aplicação

- `GetDashboardSummaryUseCase.execute()` passa a retornar, por conta, `{ currentBalance,
projectedBalance }` além do que já existe. `netWorth` do dashboard passa a ser a soma dos
  `currentBalance` (não mais `account.balance` diretamente) — "quanto tenho agora", que é a
  pergunta que `netWorth` sempre pretendeu responder.
- `GetAccountsUseCase.execute()` ganha o mesmo par de valores por conta (busca as transações
  futuras de cada conta numa query adicional, `WHERE occurred_at > now()`).
- Dashboard: bloco "Saldo atual" em destaque (visual predominante) + bloco secundário "Saldo
  projetado", com uma lista curta dos compromissos futuros que compõem a diferença (ex: "13
  parcelas restantes de Financiamento apartamento — R$ 2.145,00"), agrupados por `installmentPlanId`/
  `recurringRuleId` quando aplicável.
- `/accounts`: cada card de conta mostra o saldo atual como número principal; o saldo projetado
  aparece como um texto secundário menor ("projetado: R$ X"), só quando os dois valores diferem
  (evita ruído visual para contas sem parcelas/recorrências futuras).

## 2. Parcelamento flexível

`createInstallmentPlanSchema` passa a aceitar `totalAmount` **ou** `installmentAmount` (exatamente
um dos dois, via `.refine`). `CreateInstallmentPlanUseCase` calcula o que faltar:

- Se `installmentAmount` foi informado: `totalAmount = installmentAmount * installmentCount`
  (multiplicação exata — sem resto, ao contrário da direção total→parcelas).
- Se `totalAmount` foi informado: comportamento atual, inalterado (`splitEvenly` já trata
  centavos, absorvendo o resto na última parcela).

UI (`transaction-form.tsx`/formulário de parcelamento): toggle "Valor total" / "Valor da parcela"
trocando qual campo é o de entrada; o outro valor é calculado e exibido em tempo real (client-side,
sem submissão) conforme o usuário digita, usando a mesma aritmética do backend para não haver
divergência entre o que o usuário vê e o que é persistido.

## 3. Importação: preview + detecção de duplicidade (escopo priorizado)

Sem armazenamento temporário no servidor — o preview é inteiramente responsabilidade do
ida-e-volta cliente/servidor, consistente com a ausência de infraestrutura de fila/sessão nesta
aplicação.

**Etapa 1 — `previewImportAction`**: recebe o arquivo, faz o parsing e toda a validação que
`createImportAction` já faz hoje (casamento de conta/categoria por nome, tipo, valor, data), **mas
não persiste nada**. Para cada linha válida, verifica duplicidade: existe uma transação na mesma
conta, mesmo valor (exato) e data dentro de ±1 dia? Se sim, marca a linha com um aviso de possível
duplicata (não bloqueia — o usuário decide). Retorna a lista completa de linhas processadas com seu
status (`valid`, `valid_possible_duplicate`, `invalid` + motivo) para o cliente.

**Etapa 2 — preview no cliente**: `import-preview-table.tsx` renderiza a lista recebida — linhas
inválidas aparecem cinza/desabilitadas com o motivo; linhas com possível duplicata vêm
pré-desmarcadas com um checkbox que o usuário pode marcar para importar mesmo assim; linhas válidas
vêm pré-marcadas. Um contador mostra "N de M linhas serão importadas".

**Etapa 3 — `confirmImportAction`**: recebe exatamente as linhas que o usuário manteve marcadas
(reenviadas como JSON, já validadas na etapa 1 — não há necessidade de re-parsear o CSV) e cria as
transações, uma por `withTransaction`, igual ao fluxo atual. Retorna o resumo final.

Mapeamento manual de colunas fica fora desta rodada — o formato de cabeçalho esperado continua
sendo o mesmo do CSV exportado (`Data, Descrição, Conta, Categoria, Tipo, Valor`).

## 4. Preferências de visualização persistidas

### Schema

Nova tabela `user_view_preferences`:

- `id` (uuid, pk)
- `user_id` (fk → user, cascade)
- `screen_key` (varchar — ex: `'transactions'`; permite outras telas reaproveitarem a mesma tabela
  sem migração nova)
- `view_mode` (varchar — ex: `'chronological' | 'grouped_by_category' | 'grouped_by_month'`)
- `created_at`, `updated_at`
- Índice único em `(user_id, screen_key)` — uma preferência por usuário por tela.

### Aplicação

- `core/contracts/view-preference-repository.ts` + `infra/repositories/drizzle-view-preference.repository.ts`.
- `GetViewPreferenceUseCase(userId, screenKey)` / `SetViewPreferenceUseCase(userId, screenKey, viewMode)`
  — CRUD simples com upsert (via `onConflictDoUpdate` na chave única), mesmo padrão dos outros
  módulos.
- `/transactions` ganha um seletor de modo de visualização (lista cronológica atual / agrupado por
  categoria / agrupado por mês) persistido via Server Action leve (`setViewPreferenceAction`),
  lido no carregamento da página (Server Component) e aplicado à renderização da lista.
- Only `/transactions` recebe UI concreta nesta rodada — a tabela e os use-cases são desenhados
  para que uma tela futura (`/accounts`, `/budgets`) só precise de sua própria `screenKey` e seu
  próprio seletor de UI, sem tocar em schema ou nos use-cases.

## Fora de escopo desta rodada

- Re-arquitetura da materialização de parcelas/recorrências (decisão explícita, ver §1).
- Mapeamento manual de colunas na importação (decisão explícita, ver §3).
- Direção de transferência (débito/crédito) no schema — a limitação conhecida do §1 permanece.
- Qualquer coisa da Rodada 3 (relatórios, dashboard interativo, empty states, microcopy).

## Verificação

- Testes unitários: `computeCurrentBalance` (parcela futura de despesa reduz corretamente o saldo
  atual sem alterar o projetado; conta de crédito com sinal invertido; sem transações futuras,
  atual = projetado; múltiplas parcelas futuras somadas corretamente).
- Testes: `createInstallmentPlanSchema`/`CreateInstallmentPlanUseCase` com `installmentAmount`
  informado (total calculado corretamente, sem resto) e com `totalAmount` informado (comportamento
  atual inalterado); rejeição quando os dois ou nenhum são informados.
- Testes: `previewImportAction`'s detecção de duplicidade (linha idêntica a uma transação existente
  é marcada; linha com data ±1 dia é marcada; linha claramente diferente não é marcada).
- Testes: `GetViewPreferenceUseCase`/`SetViewPreferenceUseCase` (upsert funciona, preferência
  default quando nenhuma foi definida ainda).
- `pnpm db:generate && pnpm db:migrate` para a nova tabela.
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, `vitest run` — todos verdes.
- Manual: criar uma parcela de 15x, confirmar que o saldo atual não deduz as parcelas futuras
  (só a atual/já ocorridas) e que o saldo projetado mostra o valor completo; criar um parcelamento
  informando o valor da parcela e confirmar que o total bate; importar um CSV com uma linha
  duplicada de uma transação existente e confirmar que o preview avisa antes de confirmar; trocar o
  modo de visualização de `/transactions`, recarregar a página e confirmar que a preferência
  persistiu.
