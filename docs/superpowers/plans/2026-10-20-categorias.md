# Categorias que ajudam — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sugerir a categoria que falta ("＋ Saúde (nova)") e criá-la com um toque em todo lugar que pede categoria; trocar a tela de Categorias por uma lista com o gasto do mês, a variação contra o mês anterior e sugestões.

**Architecture:** Um catálogo de categorias comuns no domínio de `modules/categories` reconhece o estabelecimento pelas palavras da chave de `normalizeMerchant`. `GetCategorySuggestionsUseCase` passa a devolver também a categoria nova sugerida, e um caso de uso cria a categoria e classifica numa unidade de trabalho. A tela usa um caso de uso de visão geral que calcula tudo a partir das transações de seis meses.

**Tech Stack:** Next.js 16, React 19, Drizzle, Zod, Vitest + Testing Library, `recharts` só se o minigráfico precisar (SVG simples basta).

**Spec:** `docs/superpowers/specs/2026-10-19-contas-planejamento-categorias-design.md` §5

## Global Constraints

- Textos em pt-BR; regra de negócio em `modules/`/`core/`, telas em `app/`; testes com fakes, TDD.
- A categoria nova só é sugerida quando o usuário não tem uma categoria de mesmo nome (ou singular/plural), arquivada ou não, e o estabelecimento não tem regra em `merchant_rules`.
- Um toque cria a categoria, classifica a transação e grava a regra do estabelecimento, numa unidade de trabalho.
- Arquivar é sugerido para categoria sem uso há 60 dias ou mais; juntar pede confirmação dizendo quantas transações mudam.
- Variação: subiu em vermelho, desceu em verde.
- Nenhuma dependência nova.

## Review Focus

- Dois toques rápidos em "＋ Saúde" (ou o mesmo nome digitado duas vezes): uma categoria só, não duas "Saúde".
- Usuário sem nenhuma categoria: o seletor oferece a sugestão nova e a criação, em vez de só o link "Crie uma categoria".
- Mês sem gastos (ou mês anterior zerado): a tela mostra zero e "—" na variação, sem `NaN`, `Infinity` nem divisão por zero.
- Juntar uma categoria com orçamento, regra de estabelecimento e recorrência: nada fica apontando para a arquivada.
- Nome com acento ou caixa diferente ("saude", "SAÚDE"): reconhecido como a mesma categoria.

---

### Task 1: Catálogo de categorias comuns e a sugestão de categoria nova

**Files:**

- Create: `src/modules/categories/domain/category-catalog.ts`
- Create: `src/modules/categories/application/suggest-new-categories.ts`
- Test: `src/modules/categories/domain/category-catalog.test.ts`, `src/modules/categories/application/suggest-new-categories.test.ts`

**Interfaces:**

- Produces:
  - `interface CatalogCategory { key: string; name: string; color: string; words: string[] }` e `type NewCategoryHint = Pick<CatalogCategory, 'key' | 'name' | 'color'>`
  - `CATEGORY_CATALOG: CatalogCategory[]`
  - `catalogCategoryFor(description: string): CatalogCategory | null`
  - `catalogCategoryByKey(key: string): CatalogCategory | null`
  - `sameCategoryName(a: string, b: string): boolean` (sem acento, caixa, espaços, e singular/plural igual)
  - `suggestNewCategories(input: { transactions: Transaction[]; categories: Category[]; rules: Array<{ merchantKey: string }> }): Record<string, NewCategoryHint>` (por id de transação)

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  ['FARMÁCIA SÃO JOÃO S/A', 'saude'],
  ['Drogasil 24h', 'saude'],
  ['DROGARIA PAGUE MENOS', 'saude'],
  ['Uber *Trip', 'transporte'],
  ['POSTO SHELL 0123', 'transporte'],
  ['PETZ', 'pets'],
  ['Netflix.com', 'assinaturas'],
  ['Padaria Real', null],
])('recognizes %s', (description, key) => {
  expect(catalogCategoryFor(description)?.key ?? null).toBe(key);
});
it('compares names without accents, case or plural', () => {
  expect(sameCategoryName('Saúde', 'saude')).toBe(true);
  expect(sameCategoryName('Assinatura', 'Assinaturas')).toBe(true);
  expect(sameCategoryName('Saúde', 'Mercado')).toBe(false);
});
```

```ts
it('suggests the missing category for a purchase without one', () => {
  expect(
    suggestNewCategories({
      transactions: [farmacia],
      categories: [mercado],
      rules: [],
    }),
  ).toEqual({
    [farmacia.id]: { key: 'saude', name: 'Saúde', color: expect.any(String) },
  });
});
it('suggests nothing the user already has, archived or not, nor for a remembered merchant', () => {
  expect(
    suggestNewCategories({
      transactions: [farmacia],
      categories: [saudeArquivada],
      rules: [],
    }),
  ).toEqual({});
  expect(
    suggestNewCategories({
      transactions: [farmacia],
      categories: [],
      rules: [{ merchantKey: 'farmacia sao joao' }],
    }),
  ).toEqual({});
});
it.each([
  ['com categoria', farmaciaComCategoria],
  ['transferência', transferencia],
  ['pagamento de fatura', pagamentoFatura],
])('skips a purchase %s', (_, transaction) => {
  expect(
    suggestNewCategories({
      transactions: [transaction],
      categories: [],
      rules: [],
    }),
  ).toEqual({});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/categories`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement the catalog and the suggestion**

O catálogo é dado: Saúde (farmacia, drogaria, drogasil, raia, droga raia, pague menos, panvel, clinica, laboratorio, hospital, dentista), Transporte (uber, posto, combustivel, estacionamento, pedagio, sem parar, metro), Pets (petz, cobasi, pet shop, petshop, veterinario), Assinaturas (netflix, spotify, prime video, disney, icloud, youtube premium), Educação (escola, curso, faculdade, livraria, udemy), Casa (leroy merlin, telhanorte, material de construcao). Cada uma com uma cor hexadecimal fixa. Uma palavra do catálogo casa quando aparece como palavra inteira (ou sequência de palavras) na chave de `normalizeMerchant`. `sameCategoryName` reaproveita a dobra de `normalizeMerchant` e a regra de singular do `parse-quick-entry` (sem o "s" final).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/categories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/categories
git commit -m "feat(categories): recognize the common category a purchase is missing"
```

### Task 2: Criar a categoria e classificar, numa unidade de trabalho

**Files:**

- Create: `src/modules/transactions/application/file-under-new-category.use-case.ts`
- Test: `src/modules/transactions/application/file-under-new-category.use-case.test.ts`

**Interfaces:**

- Consumes: `sameCategoryName` (Task 1), `CategorizeTransactionUseCase`.
- Produces: `class FileUnderNewCategoryUseCase { constructor(transactions, accounts, categories, merchantRules); execute(input: { userId: string; name: string; color?: string; transactionIds: string[] }): Promise<{ category: Category; created: boolean }> }`

- [ ] **Step 1: Write the failing tests**

```ts
it('creates the category, files the purchase and remembers the merchant', async () => {
  const { category, created } = await fileUnder.execute({
    userId,
    name: 'Saúde',
    color: '#ef4444',
    transactionIds: [farmacia.id],
  });
  expect(created).toBe(true);
  expect((await transactions.findById(farmacia.id))?.categoryId).toBe(
    category.id,
  );
  expect((await rules.findByKey(userId, 'farmacia sao joao'))?.categoryId).toBe(
    category.id,
  );
});
it('reuses a category of the same name instead of making a second one', async () => {
  await fileUnder.execute({
    userId,
    name: 'Saúde',
    transactionIds: [farmacia.id],
  });
  const again = await fileUnder.execute({
    userId,
    name: 'saude',
    transactionIds: [outraFarmacia.id],
  });
  expect(again.created).toBe(false);
  expect(
    (await categories.findByUserId(userId)).filter((c) =>
      sameCategoryName(c.name, 'Saúde'),
    ),
  ).toHaveLength(1);
});
it('files several purchases at once', async () => {
  const { category } = await fileUnder.execute({
    userId,
    name: 'Saúde',
    transactionIds: [f1.id, f2.id, f3.id],
  });
  for (const id of [f1.id, f2.id, f3.id])
    expect((await transactions.findById(id))?.categoryId).toBe(category.id);
});
it('refuses an empty name', async () => {
  await expect(
    fileUnder.execute({ userId, name: '  ', transactionIds: [] }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/transactions/application/file-under-new-category.use-case.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `FileUnderNewCategoryUseCase`**

Procura entre as categorias **não arquivadas** do usuário uma com `sameCategoryName`; se não houver, cria (`randomUUID`, nome com `trim`, a cor recebida). Depois chama `CategorizeTransactionUseCase` para cada id. O chamador roda tudo em `withTransaction`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/transactions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/transactions/application/file-under-new-category.use-case.ts src/modules/transactions/application/file-under-new-category.use-case.test.ts
git commit -m "feat(transactions): file a purchase under a category made on the spot"
```

### Task 3: "＋ Saúde (nova)" e "Nova categoria…" no seletor do app

**Files:**

- Modify: `src/modules/categories/application/get-category-suggestions.use-case.ts` (devolve `{ categories: Record<string, string[]>; newCategories: Record<string, NewCategoryHint> }`)
- Modify: `src/modules/dashboard/application/get-dashboard-summary.use-case.ts:68,229-240` (novo campo `newCategorySuggestions: Record<string, NewCategoryHint>`)
- Modify: `src/app/transactions/load-transaction-page.ts`, `src/app/transactions/use-transaction-pages.ts`, `src/app/transactions/transaction-list.tsx`, `src/app/transactions/transaction-row.tsx` (novo campo `newCategories` nas páginas, juntado como `suggestions`)
- Modify: `src/app/dashboard/category-picker.tsx`, `src/app/dashboard/review-queue.tsx`, `src/app/dashboard/recent-transactions.tsx`, `src/app/dashboard/page.tsx`
- Modify: `src/app/transactions/transaction-edit-dialog.tsx:172-191` (opção "＋ Nova categoria…" no campo Categoria)
- Modify: `src/app/dashboard/actions.ts` (nova `fileUnderNewCategoryAction`)
- Modify: `src/modules/capture/application/describe-capture.ts` (lê `.categories` do novo retorno)
- Test: `src/app/dashboard/category-picker.test.tsx` (novo); atualizar `get-category-suggestions.use-case.test.ts`

**Interfaces:**

- Consumes: `suggestNewCategories`, `NewCategoryHint` (Task 1); `FileUnderNewCategoryUseCase` (Task 2).
- Produces:
  - `fileUnderNewCategoryAction(input: { transactionIds: string[]; name: string; color?: string }): Promise<{ success: true; category: CategoryOption } | { success: false; error: string }>`, que valida com Zod (ids `uuid`, nome 1–60 caracteres), roda em `withTransaction`, chama `revalidateMoneyPages()` e `revalidatePath(ROUTES.categories)`
  - `CategoryPicker` com as props novas `newCategory?: NewCategoryHint` e `onCreate: (name: string, color?: string) => void`

- [ ] **Step 1: Write the failing tests**

```tsx
it('offers the missing category first, and creates it with one tap', async () => {
  render(
    <CategoryPicker
      subject="Drogasil"
      suggestions={[essenciais]}
      categories={[essenciais]}
      newCategory={{ key: 'saude', name: 'Saúde', color: '#ef4444' }}
      onPick={onPick}
      onCreate={onCreate}
    />,
  );
  const buttons = screen.getAllByRole('button');
  expect(buttons[0]).toHaveTextContent('Saúde');
  expect(buttons[0]).toHaveTextContent('nova');
  await userEvent.click(buttons[0]);
  expect(onCreate).toHaveBeenCalledWith('Saúde', '#ef4444');
});
it('creates a category typed under "Outra…"', async () => {
  render(
    <CategoryPicker
      subject="Petz"
      suggestions={[]}
      categories={[essenciais]}
      onPick={onPick}
      onCreate={onCreate}
    />,
  );
  await userEvent.selectOptions(
    screen.getByRole('combobox'),
    '＋ Nova categoria…',
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Nome da categoria' }),
    'Pets',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Criar' }));
  expect(onCreate).toHaveBeenCalledWith('Pets', undefined);
});
it('lets a user with no categories create one right there', () => {
  render(
    <CategoryPicker
      subject="Petz"
      suggestions={[]}
      categories={[]}
      onPick={onPick}
      onCreate={onCreate}
    />,
  );
  expect(
    screen.getByRole('textbox', { name: 'Nome da categoria' }),
  ).toBeInTheDocument();
});
```

E em `get-category-suggestions.use-case.test.ts`: `newCategories[farmacia.id]` é `{ key: 'saude', … }` e `categories` continua com as sugestões de antes.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/dashboard/category-picker.test.tsx src/modules/categories`
Expected: FAIL.

- [ ] **Step 3: Implement the picker and wire it**

- O seletor mostra a sugestão nova antes das existentes, com borda tracejada e "(nova)". No `select` "Outra…" entra a opção "＋ Nova categoria…", que troca o `select` por um campo e o botão **Criar** (Enter também cria; Esc volta). Sem nenhuma categoria, o campo aparece direto no lugar do link.
- Em "Para revisar", na lista do Início e na lista de Transações, `onCreate` chama `fileUnderNewCategoryAction` com o id da linha. No sucesso, a linha some de "Para revisar" e, nas listas, passa a mostrar a categoria nova (guarde o `CategoryOption` devolvido no estado local até a página recarregar). No erro, toast com a mensagem, como `categorizeTransactionAction`.
- `describe-capture.ts` passa a ler `result.categories[transaction.id]`.
- No diálogo de edição de transação, "＋ Nova categoria…" no campo Categoria abre o mesmo campo; **Criar** chama `fileUnderNewCategoryAction` com o id da transação e, no sucesso, a categoria nova entra nas opções já selecionada.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app src/modules`
Expected: PASS.

- [ ] **Step 5: Check it in the running app**

Registre pelo registro rápido "farmácia 30": em "Para revisar" aparece "＋ Saúde (nova)"; um toque classifica, e a próxima "farmácia 12" já entra em Saúde.

- [ ] **Step 6: Commit**

```bash
git add src/app src/modules
git commit -m "feat(categories): suggest the missing category and create one without leaving the purchase"
```

### Task 4: "＋ Saúde" nos botões do Telegram

**Files:**

- Modify: `src/modules/capture/domain/chat-action.ts` (nova ação `{ kind: 'new-category'; captureId: string; key: string }`, código `'n'`, `key` em `/^[a-z-]{1,20}$/`)
- Modify: `src/modules/capture/domain/capture-message.ts` (`RecordedView.newCategory?: { key: string; name: string }`, botão "＋ Saúde" antes das sugestões)
- Modify: `src/modules/capture/application/describe-capture.ts`, `src/modules/capture/application/press-chat-button.ts`
- Test: `capture-message.test.ts`, `chat-action.test.ts`, `handle-chat-update.use-case.test.ts`

**Interfaces:**

- Consumes: `catalogCategoryByKey` (Task 1), `FileUnderNewCategoryUseCase` (Task 2), `newCategories` (Task 3).

- [ ] **Step 1: Write the failing tests**

```ts
// capture-message.test.ts
expect(
  labels(
    captureMessage({
      ...recorded,
      newCategory: { key: 'saude', name: 'Saúde' },
    }),
  )?.[0][0],
).toBe('＋ Saúde');
// chat-action.test.ts
expect(
  decodeChatAction(
    encodeChatAction({
      kind: 'new-category',
      captureId: CAPTURE,
      key: 'saude',
    }),
  ),
).toEqual({ kind: 'new-category', captureId: CAPTURE, key: 'saude' });
expect(decodeChatAction(`n:${packed}:Saude!`)).toBeNull();
// handle-chat-update.use-case.test.ts
it('creates the missing category from the chat and files the purchase', async () => {
  const { captureId, messageId } = await announced({
    merchant: 'DROGASIL 24H',
  });
  await tap({ kind: 'new-category', captureId, key: 'saude' }, messageId);
  const saude = (await world.deps.categories.findByUserId(USER_ID)).find(
    (c) => c.name === 'Saúde',
  );
  expect((await transactionOf(captureId))?.categoryId).toBe(saude?.id);
  expect(channel.latest(messageId)?.text).toContain(
    'Da próxima vez, Drogasil H já entra em Saúde.',
  );
});
```

(O nome exibido é o que `normalizeMerchant` produz para a descrição; ajuste o texto esperado ao que ele gerar.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/capture`
Expected: FAIL.

- [ ] **Step 3: Implement the action, the button and the handler**

`pressChatButton`: para `new-category`, se a captura gravada tem transação sem plano, `catalogCategoryByKey(key)` dá nome e cor, `FileUnderNewCategoryUseCase` classifica e a mensagem volta com `learned: true`. Chave desconhecida, ou captura que mudou, segue o caminho `current(CHANGED)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/capture`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/capture
git commit -m "feat(capture): offer the missing category as a button in the chat"
```

### Task 5: Visão geral das categorias de um mês

**Files:**

- Create: `src/modules/categories/application/get-categories-overview.use-case.ts`
- Test: `src/modules/categories/application/get-categories-overview.use-case.test.ts`

**Interfaces:**

- Consumes: `suggestNewCategories`, `sameCategoryName` (Task 1); `GetBudgetProgressUseCase`; `normalizeMerchant`.
- Produces:

```ts
interface CategoryRow {
  id: string;
  name: string;
  color?: string;
  spent: number;
  count: number;
  share: number; // share de 0 a 1 do total do mês
  previous: number;
  deltaPercent: number | null; // null quando o mês anterior é 0
  budget: { spent: number; amount: number } | null; // só o orçamento que cobre o mês
  months: number[]; // 6 valores, o mais antigo primeiro, terminando no mês
  topMerchants: Array<{ name: string; total: number }>; // até 3, no mês
}
interface CategoriesOverview {
  month: string;
  previousMonth: string; // "2026-10", "2026-09"
  spent: number;
  previousSpent: number;
  deltaPercent: number | null;
  rows: CategoryRow[]; // categorias com gasto, ordenadas por spent desc; as de gasto zero no fim, por nome
  incomeRows: CategoryRow[]; // categorias usadas só para entradas na janela; valores do lado das entradas
  archived: Array<{ id: string; name: string; color?: string }>;
  suggestions: {
    create: Array<{
      key: string;
      name: string;
      color: string;
      transactionIds: string[];
      total: number;
    }>;
    archive: Array<{ categoryId: string; name: string }>;
    merge: Array<{
      keepId: string;
      keepName: string;
      mergeId: string;
      mergeName: string;
      mergeCount: number;
    }>;
  };
}
class GetCategoriesOverviewUseCase {
  constructor(transactions, categories, merchantRules, budgets);
  execute(input: {
    userId: string;
    month: string;
    now?: Date;
  }): Promise<CategoriesOverview>;
}
```

- [ ] **Step 1: Write the failing tests**

```ts
it('totals the month per category, with its share and the change from the month before', async () => {
  // set: Mercado 1000; out: Mercado 1240, Restaurantes 820,40
  const overview = await get.execute({ userId, month: '2026-10', now: NOW });
  expect(overview.rows.map((r) => [r.name, r.spent, r.deltaPercent])).toEqual([
    ['Mercado', 1240, 24],
    ['Restaurantes', 820.4, null],
  ]);
  expect(overview.rows[0].share).toBeCloseTo(1240 / 2060.4);
});
it('counts six months, the selected one last', async () => {
  expect(overview.rows[0].months).toEqual([0, 0, 0, 0, 1000, 1240]);
});
it('lists where the month was spent most', async () => {
  expect(overview.rows[0].topMerchants[0]).toEqual({
    name: 'Mercado Condor',
    total: 900,
  });
});
it('keeps income-only categories apart', async () => {
  expect(overview.incomeRows.map((r) => r.name)).toEqual(['Salário']);
});
it('shows zero and no change for a month without spending', async () => {
  const empty = await get.execute({ userId, month: '2026-01', now: NOW });
  expect([empty.spent, empty.deltaPercent]).toEqual([0, null]);
});
it('suggests creating the missing category with the purchases it would take', async () => {
  expect(overview.suggestions.create).toEqual([
    {
      key: 'saude',
      name: 'Saúde',
      color: expect.any(String),
      transactionIds: [f1.id, f2.id, f3.id],
      total: 356.7,
    },
  ]);
});
it('suggests archiving a category unused for 60 days, not a new one', async () => {
  // Lazer: criada há 90 dias, última compra há 61; Pets: criada ontem, sem compras
  expect(overview.suggestions.archive).toEqual([
    { categoryId: lazer.id, name: 'Lazer' },
  ]);
});
it('suggests merging look-alike categories, keeping the busier one', async () => {
  expect(overview.suggestions.merge).toEqual([
    {
      keepId: mercado.id,
      keepName: 'Mercado',
      mergeId: supermercado.id,
      mergeName: 'Supermercado',
      mergeCount: 2,
    },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/categories/application/get-categories-overview.use-case.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `GetCategoriesOverviewUseCase`**

Uma leitura de transações da menor data entre o início do 5º mês antes e 90 dias antes de `now` até o fim do mês (ou `now`, o que vier depois). Gasto conta `countsAs('expense')`. `deltaPercent` é arredondado para inteiro. Parecidas para juntar: duas não arquivadas cujo nome dobrado é igual, igual no singular, ou contém o outro (os dois com 4 letras ou mais); fica a com mais transações, e `mergeCount` conta todas as transações da que sai. `budget` só existe quando um orçamento do usuário para a categoria cobre o mês.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/categories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/categories
git commit -m "feat(categories): a month's spending per category, with what changed and what to tidy"
```

### Task 6: Juntar duas categorias

**Files:**

- Create: `src/modules/categories/application/merge-categories.use-case.ts`
- Modify: `src/app/categories/actions.ts` (nova `mergeCategoriesAction(input: { keepId: string; mergeId: string }): Promise<ActionResult>`)
- Test: `src/modules/categories/application/merge-categories.use-case.test.ts`

**Interfaces:**

- Produces: `class MergeCategoriesUseCase { constructor(categories, transactions, budgets, merchantRules, recurringTransactions); execute(input: { userId: string; keepId: string; mergeId: string }): Promise<{ moved: number }> }`

- [ ] **Step 1: Write the failing tests**

```ts
it('moves everything to the category that stays and archives the other', async () => {
  const { moved } = await merge.execute({
    userId,
    keepId: mercado.id,
    mergeId: supermercado.id,
  });
  expect(moved).toBe(2);
  expect(
    (await transactions.findByUserId(userId, { categoryId: supermercado.id }))
      .length,
  ).toBe(0);
  expect((await budgets.findById(budgetSupermercado.id))?.categoryId).toBe(
    mercado.id,
  );
  expect((await rules.findByKey(userId, 'condor'))?.categoryId).toBe(
    mercado.id,
  );
  expect(
    (await recurring.findById(assinaturaSupermercado.id))?.categoryId,
  ).toBe(mercado.id);
  expect((await categories.findById(supermercado.id))?.archived).toBe(true);
});
it('refuses merging a category into itself, into an archived one, or someone else’s', async () => {
  await expect(
    merge.execute({ userId, keepId: mercado.id, mergeId: mercado.id }),
  ).rejects.toBeInstanceOf(DomainError);
  await expect(
    merge.execute({ userId, keepId: arquivada.id, mergeId: supermercado.id }),
  ).rejects.toMatchObject({ code: 'CATEGORY_ARCHIVED' });
  await expect(
    merge.execute({
      userId: 'user-2',
      keepId: mercado.id,
      mergeId: supermercado.id,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/categories/application/merge-categories.use-case.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the merge and its action**

Cada entidade é regravada com o `categoryId` novo (`new Transaction({ ...props, categoryId })`, idem para orçamento, regra e recorrência); o saldo das contas não muda. A action valida os dois `uuid`, roda em `withTransaction` e revalida Categorias e as páginas de dinheiro.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/categories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/categories src/app/categories/actions.ts
git commit -m "feat(categories): merge two categories that are the same"
```

### Task 7: A nova tela de Categorias

**Files:**

- Modify: `src/app/categories/page.tsx` (lê `?mes=AAAA-MM`; padrão é o mês atual)
- Create: `src/app/categories/category-share-bar.tsx`, `src/app/categories/category-suggestions.tsx`, `src/app/categories/category-list.tsx`, `src/app/categories/category-row-menu.tsx`
- Delete: `src/app/categories/category-card.tsx`
- Test: `src/app/categories/category-list.test.tsx`

**Interfaces:**

- Consumes: `CategoriesOverview` (Task 5); `fileUnderNewCategoryAction` (Task 3); `mergeCategoriesAction` (Task 6); `archiveCategoryAction`, `updateCategoryAction`, `deleteCategoryAction` (existentes).

- [ ] **Step 1: Write the failing test**

```tsx
it('lists the categories as rows and opens one to show where the money went', async () => {
  render(
    <CategoryList
      rows={[mercadoRow, restaurantesRow]}
      incomeRows={[]}
      archived={[]}
      month="2026-10"
    />,
  );
  const rows = screen.getAllByRole('row');
  expect(rows[1]).toHaveTextContent('Mercado');
  expect(within(rows[1]).getByText('▲ 24%')).toHaveClass('text-destructive');
  await userEvent.click(
    within(rows[1]).getByRole('button', { name: /Mercado/ }),
  );
  expect(screen.getByText('Mercado Condor')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Ver as 18 transações/ }),
  ).toHaveAttribute('href', '/transactions?categoryId=' + mercadoRow.id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/categories/category-list.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Build the screen**

Do topo para baixo, como no esboço `categorias-tela.html`:

- mês com anterior/próximo (links `?mes=`), total do mês e variação;
- `CategoryShareBar` com a fatia de cada uma (as menores juntas em "Outras" a partir da 6ª);
- `CategorySuggestions`, só quando houver alguma, com **Criar e classificar**, **Arquivar** e **Juntar** (este com `ConfirmDialog`: "Juntar Supermercado em Mercado? 2 transações passam para Mercado e Supermercado é arquivada.");
- `CategoryList` com cabeçalho e colunas Categoria, Mês, Do total, vs mês anterior e Orçamento. Clicar numa linha abre o detalhe: onde mais gastou, um minigráfico de 6 meses em SVG simples e o link para `/transactions?categoryId=<id>`. Abaixo vêm o grupo "Entradas" e as arquivadas, recolhidas;
- `CategoryRowMenu` (componente `Menu` existente) com renomear e cor (o formulário de categoria existente), arquivar e excluir.

Siga `docs/ui-ux.md`, sem os blocos grandes de antes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS em tudo.

- [ ] **Step 5: Check it in the running app**

`/categories` responde sem rolar quais categorias mais gastaram no mês e o que subiu ou desceu; trocar o mês muda os números; as sugestões fazem o que dizem; tudo funciona numa janela de 390 px e no tema escuro.

- [ ] **Step 6: Commit**

```bash
git add src/app/categories
git commit -m "feat(categories): the month per category in one list, with suggestions"
```
