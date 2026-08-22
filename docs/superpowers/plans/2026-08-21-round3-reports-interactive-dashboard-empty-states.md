# Rodada 3 — Relatórios comparativos, dashboard interativo, empty states, microcopy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task, with the SAME PROCESS MODIFICATION the user requested for Round 2 and explicitly reconfirmed for this round despite Round 2 surfacing real risk from it: **no per-task review.** Dispatch implementers sequentially (never in parallel — several tasks share files), record each completion in the ledger, and run exactly ONE consolidated review of all 6 tasks together at the end, followed by the standard one-fix-wave-plus-one-scoped-re-review pattern (and, if that re-review finds new load-bearing breakage the way Round 2's did, one further controller-ruled corrective fix, personally verified by the controller — same precedent both Round 1 and Round 2 established). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/reports` answer "which category grew the most?" and "how much of my income goes to recurring expenses?", make the dashboard's cash-flow chart clickable into the transactions it represents, consolidate empty-state UI, and add short explanatory copy to less-obvious features.

**Architecture:** All four features are additive. Report comparisons extend the existing `GetSpendingReportUseCase` (no new use-case, no schema change — pure aggregation, consistent with how it already works). Dashboard interactivity reuses `/transactions`'s existing `from`/`to`/`type` query-string filters (Round 1) — no new route, no new component beyond a `<Link>` wrapping existing bars. Empty states get one new reusable component consolidating markup that already exists in three places. Microcopy is copy-only.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Drizzle ORM + PostgreSQL, Vitest. **The `dataviz` skill must be loaded and followed before writing any chart markup in Task 3** — this is a hard requirement carried over from this project's established convention (Part H and Round 1 both required it for chart work).

**Spec:** `docs/superpowers/specs/2026-08-21-round3-reports-interactive-dashboard-empty-states-design.md`

## Global Constraints

- TypeScript strict mode, no `any`. `app → modules → core` / `infra` layering — `GetSpendingReportUseCase` stays in `modules/reports/application`, no new contracts needed (reuses `RecurringTransactionRepository`, already exists from Part F).
- No schema changes, no new database dependency — everything here is a read-side aggregation.
- No new runtime dependency.
- Imports must pass `simple-import-sort/imports` (`npx eslint --fix`).
- Currency via `formatCurrency`, dates via `formatDate`/`formatMonthLabel` — never reimplement.
- Client Components only ever receive plain serializable objects — no entity instances, no `Map` (this exact bug class hit both Round 1 and Round 2 — check every Server→Client prop boundary this plan touches).
- No per-task review this round (see header note) — every task must still leave `tsc`/`eslint`/`vitest` fully green before the next task starts, since there is no per-task safety net until the final review.
- Brush-select interaction on the dashboard chart is explicitly out of scope (decided in Round 1, reconfirmed in this round's spec) — do not add it.

---

## File Structure

**New files:**

- `src/components/ui/empty-state.tsx` — the reusable `EmptyState` component.
- `src/modules/reports/application/get-spending-report.use-case.test.ts` — extended (existing file, add cases, don't replace).

**Modified files:**

- `src/modules/reports/application/get-spending-report.use-case.ts` — adds `categoryComparison` and `recurringExpenseShare` to `SpendingReport`, takes a `RecurringTransactionRepository` as a new constructor dependency.
- `src/app/reports/page.tsx` — new constructor argument, two new UI sections, empty-state consolidation for the budgets-overview block.
- `src/app/dashboard/page.tsx` — cash-flow bars become links; hero empty state gets the "ghost preview" treatment.
- `src/app/loans/page.tsx`, `src/app/categories/page.tsx` — empty-state consolidation.
- `src/app/budgets/page.tsx` — microcopy.
- `src/app/transactions/page.tsx` (the "Recorrências" card section) — microcopy touch-up.
- `src/app/loans/page.tsx` (form area, separate from its empty-state edit) — microcopy.

---

### Task 1: Extend `GetSpendingReportUseCase` — category comparison + recurring expense share

**Files:**

- Modify: `src/modules/reports/application/get-spending-report.use-case.ts`
- Modify: `src/modules/reports/application/get-spending-report.use-case.test.ts`
- Modify: `src/app/reports/page.tsx` (constructor call site only — no UI changes yet, that's Task 2)

**Interfaces:**

- Consumes: `RecurringTransactionRepository.findByUserId(userId): Promise<RecurringTransaction[]>` (existing, `src/core/contracts/recurring-transaction-repository.ts`), `RecurringTransaction.active`/`.type`/`.amount` getters (existing).
- Produces: `CategoryComparison { categoryId: string; categoryName: string; currentTotal: number; previousTotal: number; deltaPercent: number | null }`, `RecurringExpenseShare { monthlyRecurringExpense: number; averageMonthlyIncome: number; percentage: number | null }`, both added to `SpendingReport`. `GetSpendingReportUseCase`'s constructor gains a 5th parameter, `recurringTransactionRepository: RecurringTransactionRepository`. Consumed by Task 2 (UI).

- [ ] **Step 1: Read the current use-case and its test file in full**

Both files already exist from an earlier round in this session — re-read them live before editing; do not assume the plan's quoted snippets are byte-exact.

- [ ] **Step 2: Write the failing tests**

Add to the existing test file (following its established `makeAccount`/`makeTransaction`/`buildUseCase` helper style — extend `buildUseCase` to also construct and return a `FakeRecurringTransactionRepository`, and update the `GetSpendingReportUseCase` constructor call inside it to pass the 5th argument):

```ts
import { RecurringTransaction } from '@/core/entities/recurring-transaction';
import { FakeRecurringTransactionRepository } from '@/tests/fakes/fake-recurring-transaction.repository';

function makeRecurringRule(
  overrides: Partial<{
    id: string;
    type: 'income' | 'expense';
    amount: number;
    active: boolean;
  }> = {},
) {
  return new RecurringTransaction({
    id: overrides.id ?? 'rule-1',
    userId: USER_ID,
    accountId: 'acc-1',
    description: 'Regra',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? 'expense',
    dayRuleKind: 'fixed_day',
    dayRuleDay: 5,
    startDate: new Date('2026-01-01T00:00:00'),
    active: overrides.active ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

(Check `RecurringTransaction`'s real constructor prop shape in `src/core/entities/recurring-transaction.ts` before finalizing this helper — adapt field names if they differ from the above.)

```ts
describe('GetSpendingReportUseCase — category comparison', () => {
  it('computes currentTotal/previousTotal/deltaPercent per category across two equal-length periods', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    const category = new Category({
      id: 'cat-1',
      userId: USER_ID,
      name: 'Alimentação',
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await categoryRepository.save(category);

    // Previous period (June): R$100. Current period (July): R$150 → +50%.
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-jun',
        categoryId: 'cat-1',
        amount: 100,
        occurredAt: new Date('2026-06-15T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-jul',
        categoryId: 'cat-1',
        amount: 150,
        occurredAt: new Date('2026-07-15T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    const comparison = report.categoryComparison.find(
      (c) => c.categoryId === 'cat-1',
    );
    expect(comparison?.currentTotal).toBe(150);
    expect(comparison?.previousTotal).toBe(100);
    expect(comparison?.deltaPercent).toBe(50);
  });

  it('returns deltaPercent: null for a category with no spending in the previous period', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    await categoryRepository.save(
      new Category({
        id: 'cat-new',
        userId: USER_ID,
        name: 'Nova categoria',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-only',
        categoryId: 'cat-new',
        amount: 80,
        occurredAt: new Date('2026-07-10T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    const comparison = report.categoryComparison.find(
      (c) => c.categoryId === 'cat-new',
    );
    expect(comparison?.previousTotal).toBe(0);
    expect(comparison?.deltaPercent).toBeNull();
  });

  it('sorts categoryComparison by absolute growth (currentTotal - previousTotal) descending', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      categoryRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    await categoryRepository.save(
      new Category({
        id: 'cat-small',
        userId: USER_ID,
        name: 'Pequena',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    await categoryRepository.save(
      new Category({
        id: 'cat-big',
        userId: USER_ID,
        name: 'Grande',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    // cat-small: 2 -> 20 (900% but +18 absolute). cat-big: 500 -> 800 (+300 absolute, 60%).
    await transactionRepository.save(
      makeTransaction({
        id: 't1',
        categoryId: 'cat-small',
        amount: 2,
        occurredAt: new Date('2026-06-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 't2',
        categoryId: 'cat-small',
        amount: 20,
        occurredAt: new Date('2026-07-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 't3',
        categoryId: 'cat-big',
        amount: 500,
        occurredAt: new Date('2026-06-05T00:00:00'),
      }),
    );
    await transactionRepository.save(
      makeTransaction({
        id: 't4',
        categoryId: 'cat-big',
        amount: 800,
        occurredAt: new Date('2026-07-05T00:00:00'),
      }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    expect(report.categoryComparison[0].categoryId).toBe('cat-big');
  });
});

describe('GetSpendingReportUseCase — recurring expense share', () => {
  it('sums active recurring expense rules and divides by average monthly income', async () => {
    const {
      useCase,
      accountRepository,
      transactionRepository,
      recurringTransactionRepository,
    } = await buildUseCase();
    await accountRepository.save(makeAccount());
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r1',
        type: 'expense',
        amount: 300,
        active: true,
      }),
    );
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r2',
        type: 'expense',
        amount: 200,
        active: true,
      }),
    );
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r3',
        type: 'expense',
        amount: 999,
        active: false,
      }),
    ); // inactive, excluded
    await recurringTransactionRepository.save(
      makeRecurringRule({
        id: 'r4',
        type: 'income',
        amount: 500,
        active: true,
      }),
    ); // income, excluded
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-income',
        type: 'income',
        amount: 2000,
        occurredAt: new Date('2026-07-10T00:00:00'),
      }),
    );

    // 1-month period: averageMonthlyIncome = totalIncome / 1 = 2000.
    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    expect(report.recurringExpenseShare.monthlyRecurringExpense).toBe(500);
    expect(report.recurringExpenseShare.averageMonthlyIncome).toBe(2000);
    expect(report.recurringExpenseShare.percentage).toBe(25);
  });

  it('returns percentage: null when there is no income in the period', async () => {
    const { useCase, accountRepository, recurringTransactionRepository } =
      await buildUseCase();
    await accountRepository.save(makeAccount());
    await recurringTransactionRepository.save(
      makeRecurringRule({ amount: 100, active: true }),
    );

    const report = await useCase.execute(USER_ID, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });

    expect(report.recurringExpenseShare.percentage).toBeNull();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `npx vitest run src/modules/reports/application/get-spending-report.use-case.test.ts`
Expected: FAIL (new fields/constructor arg don't exist yet).

- [ ] **Step 4: Implement**

In `src/modules/reports/application/get-spending-report.use-case.ts`, add the new imports and interfaces:

```ts
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
```

```ts
export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export interface RecurringExpenseShare {
  monthlyRecurringExpense: number;
  averageMonthlyIncome: number;
  percentage: number | null;
}
```

Add both to `SpendingReport`:

```ts
export interface SpendingReport {
  totalIncome: number;
  totalExpense: number;
  cashFlowByMonth: MonthlyCashFlow[];
  spendingByCategory: CategorySpending[];
  netWorthByMonth: NetWorthPoint[];
  budgetsOverview: BudgetProgress[];
  categoryComparison: CategoryComparison[];
  recurringExpenseShare: RecurringExpenseShare;
}
```

Add the 5th constructor parameter:

```ts
export class GetSpendingReportUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}
```

In `execute()`, alongside the existing `Promise.all` (read the current file for its exact current shape — the plan's earlier quoted version fetched `accounts`, `transactionsInPeriod`, `categories`, `budgetsOverview`), add two more parallel fetches: the previous period's transactions, and the recurring rules. Compute the previous period as the same duration immediately before `period.from`:

```ts
  async execute(userId: string, period: SpendingReportPeriod): Promise<SpendingReport> {
    const periodDurationMs = period.to.getTime() - period.from.getTime();
    const previousPeriod: SpendingReportPeriod = {
      from: new Date(period.from.getTime() - periodDurationMs - 1),
      to: new Date(period.from.getTime() - 1),
    };

    const [accounts, transactionsInPeriod, previousPeriodTransactions, categories, budgetsOverview, recurringRules] =
      await Promise.all([
        this.accountRepository.findByUserId(userId),
        this.transactionRepository.findByUserId(userId, { from: period.from, to: period.to, pageSize: 10000 }),
        this.transactionRepository.findByUserId(userId, { from: previousPeriod.from, to: previousPeriod.to, pageSize: 10000 }),
        this.categoryRepository.findByUserId(userId),
        new GetBudgetProgressUseCase(this.budgetRepository, this.transactionRepository).execute(userId),
        this.recurringTransactionRepository.findByUserId(userId),
      ]);

    const totalIncome = sumByType(transactionsInPeriod, 'income');
    const totalExpense = sumByType(transactionsInPeriod, 'expense');

    const cashFlowByMonth = buildMonthlyCashFlow(period.from, period.to, transactionsInPeriod);
    const spendingByCategory = this.buildSpendingByCategory(transactionsInPeriod, categories);
    const netWorthByMonth = await this.buildNetWorthByMonth(userId, accounts, period);
    const categoryComparison = this.buildCategoryComparison(transactionsInPeriod, previousPeriodTransactions, categories);
    const recurringExpenseShare = this.buildRecurringExpenseShare(recurringRules, totalIncome, period);

    return {
      totalIncome,
      totalExpense,
      cashFlowByMonth,
      spendingByCategory,
      netWorthByMonth,
      budgetsOverview,
      categoryComparison,
      recurringExpenseShare,
    };
  }
```

Add the two new private methods (place them near `buildSpendingByCategory`, which they parallel):

```ts
  private buildCategoryComparison(
    currentTransactions: Transaction[],
    previousTransactions: Transaction[],
    categories: Array<{ id: string; name: string }>,
  ): CategoryComparison[] {
    const currentByCategory = this.sumExpenseByCategory(currentTransactions);
    const previousByCategory = this.sumExpenseByCategory(previousTransactions);
    const categoriesById = new Map(categories.map((c) => [c.id, c]));

    const allCategoryIds = new Set([...currentByCategory.keys(), ...previousByCategory.keys()]);

    return [...allCategoryIds]
      .map((categoryId) => {
        const currentTotal = currentByCategory.get(categoryId) ?? 0;
        const previousTotal = previousByCategory.get(categoryId) ?? 0;
        return {
          categoryId,
          categoryName:
            categoryId === UNCATEGORIZED_KEY
              ? 'Sem categoria'
              : (categoriesById.get(categoryId)?.name ?? 'Categoria removida'),
          currentTotal,
          previousTotal,
          deltaPercent: previousTotal === 0 ? null : ((currentTotal - previousTotal) / previousTotal) * 100,
        };
      })
      .sort((a, b) => (b.currentTotal - b.previousTotal) - (a.currentTotal - a.previousTotal));
  }

  private sumExpenseByCategory(transactions: Transaction[]): Map<string, number> {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'expense') continue;
      const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
      totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
    }
    return totals;
  }

  private buildRecurringExpenseShare(
    recurringRules: RecurringTransaction[],
    totalIncome: number,
    period: SpendingReportPeriod,
  ): RecurringExpenseShare {
    const monthlyRecurringExpense = recurringRules
      .filter((rule) => rule.active && rule.type === 'expense')
      .reduce((sum, rule) => sum + rule.amount, 0);

    const monthsInPeriod = Math.max(
      1,
      Math.round((period.to.getTime() - period.from.getTime()) / (30 * 24 * 60 * 60 * 1000)),
    );
    const averageMonthlyIncome = totalIncome / monthsInPeriod;

    return {
      monthlyRecurringExpense,
      averageMonthlyIncome,
      percentage: averageMonthlyIncome === 0 ? null : (monthlyRecurringExpense / averageMonthlyIncome) * 100,
    };
  }
```

Note `buildCategoryComparison` reuses `UNCATEGORIZED_KEY` — confirm this constant already exists in the file (it does, per the file's current content) and is accessible from this new method (it's a module-level `const`, so yes). Also add `import type { RecurringTransaction } from '@/core/entities/recurring-transaction';` to the top imports.

- [ ] **Step 5: Update the constructor call site**

In `src/app/reports/page.tsx`, add the 5th argument:

```ts
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
```

```ts
const report = await new GetSpendingReportUseCase(
  new DrizzleAccountRepository(),
  new DrizzleTransactionRepository(),
  new DrizzleBudgetRepository(),
  new DrizzleCategoryRepository(),
  new DrizzleRecurringTransactionRepository(),
).execute(userId, { from, to });
```

Do NOT add any new UI in this task — that's Task 2's job. This step only keeps the page compiling against the new constructor signature.

- [ ] **Step 6: Run tests to confirm they pass**

Run: `npx vitest run src/modules/reports/application/get-spending-report.use-case.test.ts`
Expected: PASS, all 5 new cases plus the pre-existing ones in that file.

- [ ] **Step 7: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean, no regressions.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add category comparison and recurring-expense-share to GetSpendingReportUseCase"
```

---

### Task 2: `/reports` UI — comparison section + recurring expense card

**Files:**

- Modify: `src/app/reports/page.tsx`

**Interfaces:**

- Consumes: `report.categoryComparison`, `report.recurringExpenseShare` (Task 1).

- [ ] **Step 1: Read the current `src/app/reports/page.tsx` in full (live)**

Confirm the exact current JSX structure around the existing "Orçamentos" card (the plan's earlier grep showed it around line ~270) so this task's additions fit the established visual rhythm (`Card`/`CardHeader`/`CardContent`, `ledger-figure`, black/red-ink convention).

- [ ] **Step 2: Add the "Comparação com o período anterior" section**

Add a new `Card` (placed after the existing "Gastos por categoria" section — find it and insert directly below):

```tsx
<Card className="p-6">
  <CardHeader className="p-0">
    <CardTitle className="text-xl">Comparação com o período anterior</CardTitle>
    <CardDescription>Categorias que mais cresceram em valor.</CardDescription>
  </CardHeader>
  <CardContent className="mt-4 p-0">
    {report.categoryComparison.filter(
      (c) => c.currentTotal - c.previousTotal > 0,
    ).length === 0 ? (
      <p className="text-muted-foreground text-sm">
        Nenhuma categoria cresceu neste período em relação ao anterior.
      </p>
    ) : (
      <div className="space-y-3">
        {report.categoryComparison
          .filter((c) => c.currentTotal - c.previousTotal > 0)
          .slice(0, 5)
          .map((comparison) => (
            <div
              key={comparison.categoryId}
              className="ledger-row flex items-center justify-between"
            >
              <span className="text-sm">{comparison.categoryName}</span>
              <span className="flex items-center gap-2">
                <span className="ledger-figure text-destructive text-sm font-semibold">
                  {formatCurrency(comparison.currentTotal)}
                </span>
                {comparison.deltaPercent !== null && (
                  <span className="text-muted-foreground text-xs">
                    (+{comparison.deltaPercent.toFixed(0)}%)
                  </span>
                )}
              </span>
            </div>
          ))}
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 3: Add the "Gastos recorrentes" card**

Add directly after (or in the same grid row as, depending on the existing layout's column structure — check whether the surrounding cards are in a `grid`/`section` and follow that pattern):

```tsx
<Card className="p-6">
  <CardHeader className="p-0">
    <CardTitle className="text-xl">Gastos recorrentes</CardTitle>
    <CardDescription>
      Quanto da sua renda mensal é comprometido com recorrências ativas.
    </CardDescription>
  </CardHeader>
  <CardContent className="mt-4 p-0">
    {report.recurringExpenseShare.percentage === null ? (
      <p className="text-muted-foreground text-sm">
        Sem renda registrada neste período para calcular a proporção.
      </p>
    ) : (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="ledger-figure text-2xl font-semibold">
            {report.recurringExpenseShare.percentage.toFixed(0)}%
          </span>
          <span className="text-muted-foreground text-xs">
            {formatCurrency(
              report.recurringExpenseShare.monthlyRecurringExpense,
            )}{' '}
            de{' '}
            {formatCurrency(report.recurringExpenseShare.averageMonthlyIncome)}
          </span>
        </div>
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className={`h-full ${report.recurringExpenseShare.percentage > 50 ? 'bg-destructive' : 'bg-success'}`}
            style={{
              width: `${Math.min(100, report.recurringExpenseShare.percentage)}%`,
            }}
          />
        </div>
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 4: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/reports/page.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add category-comparison and recurring-expense-share sections to /reports"
```

---

### Task 3: Dashboard cash-flow bars become clickable

**Files:**

- Modify: `src/app/dashboard/page.tsx`

**Interfaces:** none new — reuses `/transactions`'s existing `from`/`to`/`type` query params (Round 1).

**MANDATORY FIRST STEP: load the `dataviz` skill and follow its guidance before touching any chart markup in this task.** This is a hard project convention, not optional — the same requirement applied to the reports page's charts in an earlier round.

- [ ] **Step 1: Load the `dataviz` skill**

Invoke it (via whatever mechanism this session exposes for skill invocation) before writing any JSX in this task. Follow its guidance for how interactive/clickable chart elements should be styled and made accessible (e.g. focus states, hover affordances) — apply that guidance on top of the concrete plan below, not instead of it.

- [ ] **Step 2: Read the current cash-flow chart markup in full (live)**

`src/app/dashboard/page.tsx` — find the `summary.cashFlow.map((month) => ...)` block (the plan's earlier investigation found it rendering two `<div>` bars per month, `bg-success`/`bg-destructive`, with a `title` attribute tooltip).

- [ ] **Step 3: Wrap each bar in a `<Link>` to the filtered transactions view**

Replace the two bar `<div>`s with `<Link>`s carrying the same visual classes plus the URL. Compute month boundaries and build the href:

```tsx
{
  summary.cashFlow.map((month) => {
    const monthStart = new Date(
      month.month.getFullYear(),
      month.month.getMonth(),
      1,
    );
    const monthEnd = new Date(
      month.month.getFullYear(),
      month.month.getMonth() + 1,
      0,
    );
    const toDateParam = (date: Date) => date.toISOString().slice(0, 10);

    return (
      <div
        key={month.month.toISOString()}
        className="flex flex-1 flex-col items-center gap-1"
      >
        <div className="flex h-40 w-full items-end gap-1">
          <Link
            href={`${ROUTES.transactions}?from=${toDateParam(monthStart)}&to=${toDateParam(monthEnd)}&type=income`}
            className="bg-success hover:bg-success/80 focus-visible:ring-ring flex-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            style={{ height: `${(month.income / maxFlow) * 100}%` }}
            title={`Receitas: ${formatCurrency(month.income)} — clique para ver as transações`}
            aria-label={`Ver receitas de ${formatMonthLabel(month.month)}: ${formatCurrency(month.income)}`}
          />
          <Link
            href={`${ROUTES.transactions}?from=${toDateParam(monthStart)}&to=${toDateParam(monthEnd)}&type=expense`}
            className="bg-destructive hover:bg-destructive/80 focus-visible:ring-ring flex-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            style={{ height: `${(month.expense / maxFlow) * 100}%` }}
            title={`Despesas: ${formatCurrency(month.expense)} — clique para ver as transações`}
            aria-label={`Ver despesas de ${formatMonthLabel(month.month)}: ${formatCurrency(month.expense)}`}
          />
        </div>
        <span className="font-display text-muted-foreground text-xs capitalize">
          {formatMonthLabel(month.month)}
        </span>
      </div>
    );
  });
}
```

A zero-height bar (a month with no income or no expense) is still a valid, clickable `<Link>` — it just renders as a sliver at `height: 0%`; clicking it still correctly navigates to a (legitimately empty) filtered view, which is honest behavior, not a bug to work around.

Import `Link` from `'next/link'` and `ROUTES` from `'@/config/routes'` if not already imported in this file (check first — `dashboard/page.tsx` may already import `Link` for its zero-accounts empty state).

- [ ] **Step 4: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/dashboard/page.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: Manual QA note**

No automated test for this (page-level JSX interaction, no component-testing library) — document in your task report that you traced the URL construction manually against `/transactions`'s existing filter-parsing logic (`src/app/transactions/page.tsx`'s `filters.from`/`filters.to`/`filters.type` handling, Round 1) and confirmed the query param names and date format (`YYYY-MM-DD`) match exactly.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: make dashboard cash-flow bars link to the transactions they represent"
```

---

### Task 4: `EmptyState` component + apply to `/reports`, `/loans`, `/categories`

**Files:**

- Create: `src/components/ui/empty-state.tsx`
- Modify: `src/app/reports/page.tsx` (the "Nenhum orçamento cadastrado" block)
- Modify: `src/app/loans/page.tsx` (the "Nenhum empréstimo cadastrado" block)
- Modify: `src/app/categories/page.tsx` (the "Nenhuma categoria cadastrada" block)

**Interfaces:**

- Produces: `EmptyState({ title, description, action? }: { title: string; description: string; action?: React.ReactNode }): JSX.Element`. Consumed by the three call sites in this task.

- [ ] **Step 1: Implement `EmptyState`**

```tsx
interface EmptyStateProps {
  title: string;
  description: string;
  /** A `Button`/`Link` element, if this empty state should offer a next
   * action — omit for read-only contexts (e.g. a report section with no
   * data yet, where there's nothing to "create" from that exact spot). */
  action?: React.ReactNode;
}

/**
 * The shared shape every "no data yet" screen in the app should use —
 * consolidates markup that existed as three near-identical, independently
 * drifting `<Card>` blocks across `/loans`, `/categories`, and `/reports`
 * before this component existed. Treats absence of data as an invitation
 * to act, not an error (ui-ux.md).
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border-border/70 bg-card/80 flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Apply to `/reports`**

Read `src/app/reports/page.tsx` in full (live — Task 2 already added two new cards to this file). Find the block:

```tsx
<p className="text-muted-foreground text-sm">
  Nenhum orçamento cadastrado.{' '}
  <Link href={ROUTES.budgets} className="text-foreground underline">
    Criar orçamento
  </Link>
</p>
```

Replace with:

```tsx
<EmptyState
  title="Nenhum orçamento cadastrado."
  description="Defina limites por categoria para acompanhar seus gastos aqui."
  action={
    <Link href={ROUTES.budgets} className="text-foreground text-sm underline">
      Criar orçamento
    </Link>
  }
/>
```

Add `import { EmptyState } from '@/components/ui/empty-state';`.

- [ ] **Step 3: Apply to `/loans`**

Read `src/app/loans/page.tsx` in full (live). The current block (confirmed exact current content) is:

```tsx
<Card className="border-border/70 bg-card/80 p-10 text-center">
  <p className="text-lg font-semibold">Nenhum empréstimo cadastrado.</p>
  <p className="text-muted-foreground mt-2 text-sm">
    Crie seu primeiro empréstimo para acompanhar o cronograma de pagamento.
  </p>
  {accountOptions.length > 0 ? (
    <Button className="mt-4" asChild>
      <Link href="#novo-emprestimo">Criar primeiro empréstimo</Link>
    </Button>
  ) : null}
</Card>
```

Replace it with, preserving the exact copy and the `accountOptions.length > 0` conditional CTA:

```tsx
<EmptyState
  title="Nenhum empréstimo cadastrado."
  description="Crie seu primeiro empréstimo para acompanhar o cronograma de pagamento."
  action={
    accountOptions.length > 0 ? (
      <Button className="mt-4" asChild>
        <Link href="#novo-emprestimo">Criar primeiro empréstimo</Link>
      </Button>
    ) : undefined
  }
/>
```

If live re-reading of the file shows this block has changed since the snapshot above (unlikely — no other task in this plan touches `/loans` before this one, but confirm), adapt to the real current content rather than the snippet shown here.

- [ ] **Step 4: Apply to `/categories`**

Read `src/app/categories/page.tsx` in full (live). Replace the existing empty block similarly:

```tsx
{categories.length === 0 ? (
  <EmptyState
    title="Nenhuma categoria cadastrada."
    description="Crie sua primeira categoria para começar a organizar suas transações."
    action={
      <Button asChild>
        <a href="#create-category">Criar primeira categoria</a>
      </Button>
    }
  />
) : (
  /* existing rendering unchanged */
)}
```

- [ ] **Step 5: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/components/ui/empty-state.tsx src/app/reports/page.tsx src/app/loans/page.tsx src/app/categories/page.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 6: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add reusable EmptyState component, apply to reports/loans/categories"
```

---

### Task 5: Dashboard hero — "ghost preview" empty state for zero accounts

**Files:**

- Modify: `src/app/dashboard/page.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Read the current zero-accounts block in full (live)**

`src/app/dashboard/page.tsx` — the `summary.accounts.length === 0` early-return block (the plan's earlier investigation found a plain `Card` with title/description/CTA, returned before the rest of the dashboard renders).

- [ ] **Step 2: Replace with a ghost-preview treatment**

The "ghost" effect: render a faded, non-interactive approximation of the real hero card's shape (the "Patrimônio" figure and the three sub-stats) behind/around the actual empty-state message, using placeholder numbers and `opacity`/`blur` so it reads as "this is what it'll look like," never as real data. Use `Skeleton` (already exists from Round 1, `src/components/ui/skeleton.tsx`) shapes rather than inventing new fake numbers — a skeleton is unambiguously "not real data" in a way a greyed-out fake `R$ 0,00` is not:

```tsx
if (summary.accounts.length === 0) {
  return (
    <AppShell>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none space-y-6 opacity-20 blur-[1px]"
        >
          <div className="ledger-spine rounded-xl border p-6 sm:p-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-12 w-64" />
            <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Card className="flex flex-col items-center gap-3 p-12 text-center shadow-lg">
            <CardTitle>Nenhuma conta cadastrada.</CardTitle>
            <CardDescription>
              Crie sua primeira conta para começar a acompanhar suas finanças.
            </CardDescription>
            <Link
              href={ROUTES.accounts}
              className="bg-primary text-primary-foreground mt-2 rounded-md px-4 py-2 text-sm font-medium"
            >
              Criar primeira conta
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
```

Add `import { Skeleton } from '@/components/ui/skeleton';` to the top imports.

- [ ] **Step 3: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/dashboard/page.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 4: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 5: Manual QA note**

No automated test for this (pure layout/visual). Document in your task report that the ghost background is marked `aria-hidden` (so screen readers only announce the real empty-state card, not fake numbers) and `pointer-events-none` (so it can never be clicked/tabbed to).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: ghost-preview empty state for the dashboard hero when no accounts exist"
```

---

### Task 6: Microcopy — budgets, recurring transactions, loans

**Files:**

- Modify: `src/app/budgets/page.tsx`
- Modify: `src/app/transactions/page.tsx` (the "Recorrências" card's `CardDescription`)
- Modify: `src/app/loans/page.tsx` (the loan-creation form area)

This is a batch of small, independent, same-shape copy edits — implement all three in one pass, one commit.

- [ ] **Step 1: `/budgets` — add the explanatory line from the original request**

Read `src/app/budgets/page.tsx` in full (live). Find its header area (likely a `CardHeader`/`CardTitle` near the top of the page, above the budget-creation form or list). Add a `CardDescription` (or a `<p className="text-muted-foreground text-sm">` if the surrounding structure isn't a `Card`) with exactly this text, placed directly below the page's main heading:

> "Defina quanto pretende gastar em cada categoria e acompanhe seu progresso ao longo do mês."

This is the exact phrasing the original user request itself suggested for this screen — use it verbatim, don't rephrase.

- [ ] **Step 2: `/transactions` — review the "Recorrências" card's description for clarity**

Read `src/app/transactions/page.tsx` in full (live). Find the "Recorrências" `Card`'s `CardDescription` (added during Part F of this session). If its current text already clearly explains the feature (something to the effect of "receitas e despesas que se repetem todo mês"), leave it as-is and note in your report that no change was needed — do not rewrite working copy just to have made a change. Only edit it if it's missing or genuinely unclear.

- [ ] **Step 3: `/loans` — clarify the purchase-installment vs. loan distinction**

Read `src/app/loans/page.tsx` in full (live). This screen's form lets a user create either a purchase split into installments or a loan with interest — both go through the same underlying mechanism (`InstallmentPlan`), which can be non-obvious from the UI alone. Find the form's header/description area and add (or extend the existing description with) one clarifying sentence, e.g.:

> "Um empréstimo é como uma compra parcelada, mas com juros aplicados a cada parcela — use a taxa mensal para calcular automaticamente."

Adapt the exact wording to fit naturally with whatever description text already exists there — read the current copy first and extend it rather than replacing it wholesale if there's already a reasonable start.

- [ ] **Step 4: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/budgets/page.tsx src/app/transactions/page.tsx src/app/loans/page.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: FINAL whole-project verification (this is the plan's single consolidated validation pass)**

Run every check, thoroughly, since no individual task got its own review gate this round:

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npx vitest run
npx next build
```

Expected: every command clean. Test count should be the pre-Round-3 baseline (136, per Round 2's final count) plus Task 1's 5 new tests — roughly 141 tests, all passing. If the count doesn't roughly match, investigate before proceeding.

- [ ] **Step 7: Manual QA (documented, not automated)**

With `pnpm dev` running and logged in: (a) open `/reports`, confirm the "Comparação com o período anterior" and "Gastos recorrentes" sections render sensible numbers (cross-check one category's total by hand against the transaction list); (b) on the dashboard, click an expense bar for a month with known transactions, confirm `/transactions` opens filtered to exactly that month and type; (c) archive/hide every account in a test user (or use a fresh account with none), confirm the dashboard shows the ghost-preview empty state, not an error; (d) open `/budgets`, `/loans`, `/categories` and confirm the microcopy/empty-state changes read naturally.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs(ui): add microcopy to budgets, recurring transactions, and loans"
```

---

## Final Verification Checklist

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint src --max-warnings=0` clean
- [ ] `npx vitest run` — all tests pass (Round 2's baseline of 136 plus Task 1's 5 new tests)
- [ ] `npx next build` succeeds
- [ ] Manual: `/reports` comparison and recurring-expense sections show correct numbers
- [ ] Manual: clicking a dashboard cash-flow bar opens `/transactions` correctly filtered
- [ ] Manual: dashboard shows the ghost-preview empty state for a zero-account user, not an error
- [ ] Manual: `/budgets`, `/loans`, `/categories` empty states and microcopy read naturally
