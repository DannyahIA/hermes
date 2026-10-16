# Central de Relatórios e Dados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/reports` into a full financial reports center — real charts (Recharts), four new comparisons (per-account series, year-over-year, same-month-last-year, average/median/trend), and CSV+PDF export — while extracting every report metric into independently testable pure functions that the future AI/prediction subsystem can reuse without duplicating logic.

**Architecture:** `GetSpendingReportUseCase` (332 lines, 6 metrics as private methods) is renamed `GetFinancialReportUseCase` and reduced to an orchestrator: fetch data once via repositories, delegate every computation to a pure function in `modules/reports/application/metrics/`. The four metrics already in that use case are extracted first with zero behavior change (existing tests must still pass), then four new metrics are added the same way. The report page is split from one 433-line file into a tabs shell + three section components, each consuming the richer `FinancialReport` shape. Charts are new `'use client'` components wrapping Recharts, themed from the project's existing CSS variables plus six new categorical variables.

**Tech Stack:** Next.js 16 App Router (Server Components + Route Handlers), TypeScript, Drizzle/Postgres, Vitest + Testing Library, Tailwind v4, **recharts 3.10.1** (new), **@react-pdf/renderer 4.9.0** (new).

**Spec:** `docs/superpowers/specs/2026-10-16-financial-reports-center-design.md`

## Global Constraints

- `core`/calculation code never depends on infrastructure (`docs/architecture.md`) — every `calculate-*.ts` in `modules/reports/application/metrics/` takes plain arrays/primitives, never a repository.
- Every metric already covered by `get-spending-report.use-case.test.ts` must keep passing, unchanged, through the extraction tasks (Group A) — these are refactors, not rewrites.
- YoY and same-month-last-year are anchored to "now", not the page's `from`/`to` period selector (spec §3.5).
- Tags/etiquetas are out of scope (spec §1, §9) — "Por conta" is in scope because `Account` already exists.
- No test for `page.tsx`/section components or chart/PDF visual components — matches the project's existing convention (only use cases and pure functions are unit tested; `/api/transactions/export/route.ts` itself has zero tests today, only the logic beneath it should be tested). The one deliberate exception is the new route's 401 guard (Task 23) — worth a test despite the convention, because a missed auth check on an export endpoint leaks another user's financial totals, not just a list.
- Categorical chart colors come from a validated 6-slot palette (see Task 15) — never invent/cycle a 7th hue; a 7th+ category or account folds into "Outros".
- Status colors (`--success`/`--destructive`/`--warning`) are reserved for good/bad semantics (income/expense, net-worth polarity) and are never reused as generic category identity.

## Review Focus

- YoY / same-month-last-year with zero transactions in the previous window must return `deltaPercent: null`, never `NaN`/`Infinity` — test this explicitly, it's the easiest thing to regress when porting the existing null-on-zero convention to a new calculator.
- Trend stats with fewer than 2 months of data in the selected period must return `'insuficiente'`, never attempt a regression over 0/1 points (which would divide by zero in the slope denominator).
- Hidden accounts (`account.hidden === true`) must be absent from the new "Por conta" tab's data, not just zeroed — same rule net worth already applies, easy to forget when a brand-new calculator is written from scratch.
- A donut/legend with more than 6 categories (or a multi-line chart with more than 6 accounts) must fold the tail into a single "Outros" bucket, never generate or cycle a 7th hue.
- The new `/api/reports/export` route must 401 on an unauthenticated request before touching any repository — mirror `/api/transactions/export/route.ts`'s guard exactly; a missed guard here leaks another user's financial totals, not just a list.

---

## Group A — Extract existing metrics (no behavior change)

### Task 1: `resolveCategoryName` + `UNCATEGORIZED_KEY` shared helper

**Files:**

- Create: `src/modules/reports/application/metrics/category-key.ts`
- Test: `src/modules/reports/application/metrics/category-key.test.ts`

**Interfaces:**

- Produces: `UNCATEGORIZED_KEY: string`, `resolveCategoryName(categoryId: string, categoriesById: Map<string, { name: string }>): string` — used by Tasks 4, 5, 13.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

describe('resolveCategoryName', () => {
  it('returns "Sem categoria" for the uncategorized key', () => {
    expect(resolveCategoryName(UNCATEGORIZED_KEY, new Map())).toBe(
      'Sem categoria',
    );
  });

  it('returns the category name when found', () => {
    const categoriesById = new Map([['cat-1', { name: 'Alimentação' }]]);
    expect(resolveCategoryName('cat-1', categoriesById)).toBe('Alimentação');
  });

  it('returns "Categoria removida" when the id is unknown', () => {
    expect(resolveCategoryName('cat-deleted', new Map())).toBe(
      'Categoria removida',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/category-key.test.ts`
Expected: FAIL — `category-key.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const UNCATEGORIZED_KEY = 'uncategorized';

export function resolveCategoryName(
  categoryId: string,
  categoriesById: Map<string, { name: string }>,
): string {
  if (categoryId === UNCATEGORIZED_KEY) return 'Sem categoria';
  return categoriesById.get(categoryId)?.name ?? 'Categoria removida';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/category-key.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/application/metrics/category-key.ts src/modules/reports/application/metrics/category-key.test.ts
git commit -m "feat(reports): add shared category-name resolution helper"
```

---

### Task 2: `sumByType` shared helper (dedupes an existing copy-paste)

**Files:**

- Create: `src/shared/lib/sum-by-type.ts`
- Test: `src/shared/lib/sum-by-type.test.ts`
- Modify: `src/shared/lib/build-monthly-cash-flow.ts:42-49` (delete the local `sumByType`, import the shared one)
- Modify: `src/modules/reports/application/get-spending-report.use-case.ts:340-347` (same)

**Interfaces:**

- Produces: `sumByType(transactions: Transaction[], type: Transaction['type']): number` — used by Tasks 6, 9.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { sumByType } from './sum-by-type';

function tx(type: Transaction['type'], amount: number) {
  return new Transaction({
    id: `${type}-${amount}`,
    accountId: 'acc-1',
    description: 'x',
    amount,
    type,
    occurredAt: new Date('2026-01-01T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('sumByType', () => {
  it('sums only transactions matching the given type', () => {
    const transactions = [
      tx('income', 100),
      tx('expense', 40),
      tx('income', 20),
    ];
    expect(sumByType(transactions, 'income')).toBe(120);
    expect(sumByType(transactions, 'expense')).toBe(40);
  });

  it('returns 0 for an empty list', () => {
    expect(sumByType([], 'income')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/shared/lib/sum-by-type.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Transaction } from '@/core/entities/transaction';

export function sumByType(
  transactions: Transaction[],
  type: Transaction['type'],
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/shared/lib/sum-by-type.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Replace the two duplicated copies**

In `src/shared/lib/build-monthly-cash-flow.ts`: delete the local `function sumByType(...)` (lines 42-49) and add `import { sumByType } from '@/shared/lib/sum-by-type';` at the top.

In `src/modules/reports/application/get-spending-report.use-case.ts`: delete the local `function sumByType(...)` (lines 340-347) and add the same import.

- [ ] **Step 6: Run the full existing report/cash-flow test suites to confirm no behavior changed**

Run: `pnpm vitest run src/shared/lib src/modules/reports`
Expected: PASS — every pre-existing test still passes unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/sum-by-type.ts src/shared/lib/sum-by-type.test.ts src/shared/lib/build-monthly-cash-flow.ts src/modules/reports/application/get-spending-report.use-case.ts
git commit -m "refactor(reports): dedupe sumByType into a shared helper"
```

---

### Task 3: `calculatePeriodDelta` shared helper

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-period-delta.ts`
- Test: `src/modules/reports/application/metrics/calculate-period-delta.test.ts`

**Interfaces:**

- Produces: `interface PeriodDelta { currentTotal: number; previousTotal: number; deltaPercent: number | null }`, `calculatePeriodDelta(currentTotal: number, previousTotal: number): PeriodDelta` — used by Tasks 5, 9.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { calculatePeriodDelta } from './calculate-period-delta';

describe('calculatePeriodDelta', () => {
  it('computes a positive percentage delta', () => {
    expect(calculatePeriodDelta(150, 100)).toEqual({
      currentTotal: 150,
      previousTotal: 100,
      deltaPercent: 50,
    });
  });

  it('returns deltaPercent: null when the previous total is zero', () => {
    expect(calculatePeriodDelta(80, 0)).toEqual({
      currentTotal: 80,
      previousTotal: 0,
      deltaPercent: null,
    });
  });

  it('computes a negative delta when current is lower', () => {
    const result = calculatePeriodDelta(50, 100);
    expect(result.deltaPercent).toBe(-50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-period-delta.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface PeriodDelta {
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export function calculatePeriodDelta(
  currentTotal: number,
  previousTotal: number,
): PeriodDelta {
  return {
    currentTotal,
    previousTotal,
    deltaPercent:
      previousTotal === 0
        ? null
        : ((currentTotal - previousTotal) / previousTotal) * 100,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-period-delta.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-period-delta.ts src/modules/reports/application/metrics/calculate-period-delta.test.ts
git commit -m "feat(reports): add calculatePeriodDelta shared helper"
```

---

### Task 4: Extract `calculateCategorySpending`

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-category-spending.ts`
- Test: `src/modules/reports/application/metrics/calculate-category-spending.test.ts`
- Modify: `src/modules/reports/application/get-spending-report.use-case.ts:157-186` (delete `buildSpendingByCategory` private method; call the new pure function from `execute()` instead; remove the now-unused `UNCATEGORIZED_KEY` const at line 59)

**Interfaces:**

- Consumes: `UNCATEGORIZED_KEY`, `resolveCategoryName` from `./category-key` (Task 1).
- Produces: `interface CategorySpending { categoryId: string; categoryName: string; total: number }`, `calculateCategorySpending(transactions: Transaction[], categories: Array<{ id: string; name: string }>): CategorySpending[]` — used by Task 8 (orchestrator wiring) and Task 18 (chart).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';

import { calculateCategorySpending } from './calculate-category-spending';

function tx(overrides: Partial<Parameters<typeof Transaction>[0]> = {}) {
  return new Transaction({
    id: 'tx',
    accountId: 'acc-1',
    description: 'x',
    amount: 100,
    type: 'expense',
    occurredAt: new Date('2026-08-01T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as never);
}

function category(id: string, name: string) {
  return new Category({
    id,
    userId: 'user-1',
    name,
    archived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateCategorySpending', () => {
  it('ranks spending by category, grouping uncategorized expenses, descending by total', () => {
    const categories = [
      category('cat-food', 'Alimentação'),
      category('cat-transport', 'Transporte'),
    ];
    const transactions = [
      tx({ id: 't1', categoryId: 'cat-food', amount: 150 }),
      tx({ id: 't2', categoryId: 'cat-transport', amount: 40 }),
      tx({ id: 't3', amount: 200 }),
      tx({ id: 't4', type: 'income', categoryId: 'cat-food', amount: 999 }),
    ];

    expect(calculateCategorySpending(transactions, categories)).toEqual([
      {
        categoryId: 'uncategorized',
        categoryName: 'Sem categoria',
        total: 200,
      },
      { categoryId: 'cat-food', categoryName: 'Alimentação', total: 150 },
      { categoryId: 'cat-transport', categoryName: 'Transporte', total: 40 },
    ]);
  });

  it('returns an empty array when there are no expenses', () => {
    expect(calculateCategorySpending([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-category-spending.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Transaction } from '@/core/entities/transaction';

import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  total: number;
}

export function calculateCategorySpending(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
): CategorySpending[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const totalsByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
    totalsByCategory.set(
      key,
      (totalsByCategory.get(key) ?? 0) + transaction.amount,
    );
  }

  return [...totalsByCategory.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      categoryName: resolveCategoryName(categoryId, categoriesById),
      total,
    }))
    .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-category-spending.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire into `GetSpendingReportUseCase`**

In `get-spending-report.use-case.ts`: delete the `UNCATEGORIZED_KEY` const (line 59) and the `buildSpendingByCategory` private method (lines 157-186). Add `import { calculateCategorySpending } from './metrics/calculate-category-spending';` and replace the call site:

```ts
const spendingByCategory = calculateCategorySpending(
  transactionsInPeriod,
  categories,
);
```

- [ ] **Step 6: Run the existing report test suite to confirm no behavior changed**

Run: `pnpm vitest run src/modules/reports/application/get-spending-report.use-case.test.ts`
Expected: PASS — all pre-existing tests, including "ranks spending by category...", unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-category-spending.ts src/modules/reports/application/metrics/calculate-category-spending.test.ts src/modules/reports/application/get-spending-report.use-case.ts
git commit -m "refactor(reports): extract calculateCategorySpending into a pure function"
```

---

### Task 5: Extract `calculateCategoryComparison`

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-category-comparison.ts`
- Test: `src/modules/reports/application/metrics/calculate-category-comparison.test.ts`
- Modify: `src/modules/reports/application/get-spending-report.use-case.ts:188-238` (delete `buildCategoryComparison` + `sumExpenseByCategory` private methods; call the new function from `execute()`)

**Interfaces:**

- Consumes: `UNCATEGORIZED_KEY`, `resolveCategoryName` (Task 1); `calculatePeriodDelta` (Task 3).
- Produces: `interface CategoryComparison { categoryId: string; categoryName: string; currentTotal: number; previousTotal: number; deltaPercent: number | null }`, `calculateCategoryComparison(currentTransactions: Transaction[], previousTransactions: Transaction[], categories: Array<{ id: string; name: string }>): CategoryComparison[]` — used by Task 8 and Task 9 (`calculatePeriodComparison` composes this for YoY/same-month).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Category } from '@/core/entities/category';
import { Transaction } from '@/core/entities/transaction';

import { calculateCategoryComparison } from './calculate-category-comparison';

function tx(id: string, categoryId: string, amount: number) {
  return new Transaction({
    id,
    accountId: 'acc-1',
    description: 'x',
    categoryId,
    amount,
    type: 'expense',
    occurredAt: new Date('2026-07-01T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateCategoryComparison', () => {
  it('computes currentTotal/previousTotal/deltaPercent per category', () => {
    const categories = [
      new Category({
        id: 'cat-1',
        userId: 'u1',
        name: 'Alimentação',
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ];
    const result = calculateCategoryComparison(
      [tx('t2', 'cat-1', 150)],
      [tx('t1', 'cat-1', 100)],
      categories,
    );
    expect(result).toEqual([
      {
        categoryId: 'cat-1',
        categoryName: 'Alimentação',
        currentTotal: 150,
        previousTotal: 100,
        deltaPercent: 50,
      },
    ]);
  });

  it('returns deltaPercent: null for a category with no previous spending', () => {
    const result = calculateCategoryComparison(
      [tx('t1', 'cat-new', 80)],
      [],
      [],
    );
    expect(result[0]).toMatchObject({ previousTotal: 0, deltaPercent: null });
  });

  it('sorts by absolute growth (currentTotal - previousTotal) descending', () => {
    const current = [tx('t2', 'cat-small', 20), tx('t4', 'cat-big', 800)];
    const previous = [tx('t1', 'cat-small', 2), tx('t3', 'cat-big', 500)];
    const result = calculateCategoryComparison(current, previous, []);
    expect(result[0].categoryId).toBe('cat-big');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-category-comparison.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Transaction } from '@/core/entities/transaction';

import { calculatePeriodDelta } from './calculate-period-delta';
import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

export interface CategoryComparison {
  categoryId: string;
  categoryName: string;
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

function sumExpenseByCategory(
  transactions: Transaction[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const key = transaction.categoryId ?? UNCATEGORIZED_KEY;
    totals.set(key, (totals.get(key) ?? 0) + transaction.amount);
  }
  return totals;
}

export function calculateCategoryComparison(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
): CategoryComparison[] {
  const currentByCategory = sumExpenseByCategory(currentTransactions);
  const previousByCategory = sumExpenseByCategory(previousTransactions);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const allCategoryIds = new Set([
    ...currentByCategory.keys(),
    ...previousByCategory.keys(),
  ]);

  return [...allCategoryIds]
    .map((categoryId) => {
      const currentTotal = currentByCategory.get(categoryId) ?? 0;
      const previousTotal = previousByCategory.get(categoryId) ?? 0;
      const delta = calculatePeriodDelta(currentTotal, previousTotal);
      return {
        categoryId,
        categoryName: resolveCategoryName(categoryId, categoriesById),
        ...delta,
      };
    })
    .sort(
      (a, b) =>
        b.currentTotal - b.previousTotal - (a.currentTotal - a.previousTotal),
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-category-comparison.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire into `GetSpendingReportUseCase`**

Delete `buildCategoryComparison` and `sumExpenseByCategory` (lines 188-238). Import and call:

```ts
const categoryComparison = calculateCategoryComparison(
  transactionsInPeriod,
  previousPeriodTransactions,
  categories,
);
```

- [ ] **Step 6: Run the existing report test suite to confirm no behavior changed**

Run: `pnpm vitest run src/modules/reports/application/get-spending-report.use-case.test.ts`
Expected: PASS — the "category comparison" describe block passes unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-category-comparison.ts src/modules/reports/application/metrics/calculate-category-comparison.test.ts src/modules/reports/application/get-spending-report.use-case.ts
git commit -m "refactor(reports): extract calculateCategoryComparison into a pure function"
```

---

### Task 6: Extract `calculateRecurringExpenseShare`

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-recurring-expense-share.ts`
- Test: `src/modules/reports/application/metrics/calculate-recurring-expense-share.test.ts`
- Modify: `src/modules/reports/application/get-spending-report.use-case.ts:240-264` (delete `buildRecurringExpenseShare`; call the new function)

**Interfaces:**

- Consumes: nothing new (plain arithmetic).
- Produces: `interface RecurringExpenseShare { monthlyRecurringExpense: number; averageMonthlyIncome: number; percentage: number | null }`, `calculateRecurringExpenseShare(recurringRules: RecurringTransaction[], totalIncome: number, period: { from: Date; to: Date }): RecurringExpenseShare` — used by Task 8.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { RecurringTransaction } from '@/core/entities/recurring-transaction';

import { calculateRecurringExpenseShare } from './calculate-recurring-expense-share';

function rule(
  overrides: Partial<{
    type: 'income' | 'expense';
    amount: number;
    active: boolean;
  }> = {},
) {
  return new RecurringTransaction({
    id: 'r1',
    userId: 'u1',
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

describe('calculateRecurringExpenseShare', () => {
  it('sums only active recurring expense rules and divides by average monthly income', () => {
    const rules = [
      rule({ amount: 300, active: true }),
      rule({ amount: 200, active: true }),
      rule({ amount: 999, active: false }),
      rule({ type: 'income', amount: 500, active: true }),
    ];
    const result = calculateRecurringExpenseShare(rules, 2000, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });
    expect(result.monthlyRecurringExpense).toBe(500);
    expect(result.averageMonthlyIncome).toBeCloseTo(1935.48, 2);
    expect(result.percentage).toBeCloseTo(25.83, 2);
  });

  it('returns percentage: null when there is no income in the period', () => {
    const result = calculateRecurringExpenseShare([rule({ amount: 100 })], 0, {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-07-31T23:59:59'),
    });
    expect(result.percentage).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-recurring-expense-share.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { RecurringTransaction } from '@/core/entities/recurring-transaction';

export interface RecurringExpenseShare {
  monthlyRecurringExpense: number;
  averageMonthlyIncome: number;
  percentage: number | null;
}

export function calculateRecurringExpenseShare(
  recurringRules: RecurringTransaction[],
  totalIncome: number,
  period: { from: Date; to: Date },
): RecurringExpenseShare {
  const monthlyRecurringExpense = recurringRules
    .filter((rule) => rule.active && rule.type === 'expense')
    .reduce((sum, rule) => sum + rule.amount, 0);

  const monthsInPeriod = Math.max(
    0.25,
    (period.to.getTime() - period.from.getTime()) / (30 * 24 * 60 * 60 * 1000),
  );
  const averageMonthlyIncome = totalIncome / monthsInPeriod;

  return {
    monthlyRecurringExpense,
    averageMonthlyIncome,
    percentage:
      averageMonthlyIncome === 0
        ? null
        : (monthlyRecurringExpense / averageMonthlyIncome) * 100,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-recurring-expense-share.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire into `GetSpendingReportUseCase`**

Delete `buildRecurringExpenseShare` (lines 240-264). Import and call:

```ts
const recurringExpenseShare = calculateRecurringExpenseShare(
  recurringRules,
  totalIncome,
  period,
);
```

- [ ] **Step 6: Run the existing report test suite to confirm no behavior changed**

Run: `pnpm vitest run src/modules/reports/application/get-spending-report.use-case.test.ts`
Expected: PASS — the "recurring expense share" describe block passes unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-recurring-expense-share.ts src/modules/reports/application/metrics/calculate-recurring-expense-share.test.ts src/modules/reports/application/get-spending-report.use-case.ts
git commit -m "refactor(reports): extract calculateRecurringExpenseShare into a pure function"
```

---

### Task 7: Extract `calculateNetWorthByMonth` + `netWorthFetchRange`

This is the one extraction that changes _where data is fetched_: the current `buildNetWorthByMonth` is `private async` and calls `this.transactionRepository.findByUserId(...)` itself. The pure version takes already-fetched transactions; the orchestrator fetches them using a shared range helper so both sides agree on the window.

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-net-worth-by-month.ts`
- Test: `src/modules/reports/application/metrics/calculate-net-worth-by-month.test.ts`
- Modify: `src/modules/reports/application/get-spending-report.use-case.ts:266-338` (delete `buildNetWorthByMonth` and the module-level `isIncomeOrExpense` helper; fetch `netWorthTransactions` in `execute()` and call the new function)

**Interfaces:**

- Produces: `interface NetWorthPoint { month: Date; netWorth: number }`, `netWorthFetchRange(period: { from: Date; to: Date }, now?: Date): { from: Date; to: Date }`, `calculateNetWorthByMonth(accounts: Account[], transactions: Transaction[], period: { from: Date; to: Date }, now?: Date): NetWorthPoint[]` — used by Task 8, and reused as-is by Task 12 (`calculateAccountSeries`, one account at a time).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';

import {
  calculateNetWorthByMonth,
  netWorthFetchRange,
} from './calculate-net-worth-by-month';

function account(
  overrides: Partial<{
    id: string;
    type: 'checking' | 'savings' | 'credit';
    balance: number;
    hidden: boolean;
  }> = {},
) {
  return new Account({
    id: overrides.id ?? 'acc-1',
    userId: 'u1',
    name: 'Carteira',
    type: overrides.type ?? 'checking',
    balance: overrides.balance ?? 1000,
    currency: 'BRL',
    archived: false,
    hidden: overrides.hidden ?? false,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-01T00:00:00'),
  });
}

function tx(
  overrides: Partial<{
    id: string;
    accountId: string;
    type: 'income' | 'expense' | 'transfer';
    amount: number;
    occurredAt: Date;
  }> = {},
) {
  return new Transaction({
    id: overrides.id ?? 'tx',
    accountId: overrides.accountId ?? 'acc-1',
    description: 'x',
    amount: overrides.amount ?? 100,
    type: overrides.type ?? 'expense',
    occurredAt: overrides.occurredAt ?? new Date('2026-08-10T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateNetWorthByMonth', () => {
  it('walks net worth backward from the current balance, ignoring transfers', () => {
    const now = new Date('2026-08-20T00:00:00');
    const transactions = [
      tx({
        id: 't1',
        type: 'income',
        amount: 300,
        occurredAt: new Date('2026-08-10T00:00:00'),
      }),
      tx({
        id: 't2',
        type: 'expense',
        amount: 100,
        occurredAt: new Date('2026-08-15T00:00:00'),
      }),
      tx({
        id: 't3',
        type: 'transfer',
        amount: 500,
        occurredAt: new Date('2026-08-20T00:00:00'),
      }),
    ];
    const points = calculateNetWorthByMonth(
      [account({ balance: 1000 })],
      transactions,
      {
        from: new Date('2026-07-01T00:00:00'),
        to: new Date('2026-08-20T00:00:00'),
      },
      now,
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ netWorth: 800 });
    expect(points[1]).toMatchObject({ netWorth: 1000 });
  });

  it('inverts the delta for a credit card (balance is debt)', () => {
    const now = new Date('2026-08-31T00:00:00');
    const points = calculateNetWorthByMonth(
      [account({ id: 'card-1', type: 'credit', balance: 300 })],
      [
        tx({
          accountId: 'card-1',
          type: 'expense',
          amount: 300,
          occurredAt: new Date('2026-08-05T00:00:00'),
        }),
      ],
      {
        from: new Date('2026-07-01T00:00:00'),
        to: new Date('2026-08-31T00:00:00'),
      },
      now,
    );
    expect(points[0]).toMatchObject({ netWorth: 0 });
    expect(points[1]).toMatchObject({ netWorth: 300 });
  });

  it('excludes hidden accounts', () => {
    const now = new Date('2026-08-31T00:00:00');
    const points = calculateNetWorthByMonth(
      [
        account({ id: 'visible', balance: 100 }),
        account({ id: 'hidden', balance: 5000, hidden: true }),
      ],
      [],
      {
        from: new Date('2026-08-01T00:00:00'),
        to: new Date('2026-08-31T00:00:00'),
      },
      now,
    );
    expect(points[0]?.netWorth).toBe(100);
  });
});

describe('netWorthFetchRange', () => {
  it('starts at the first day of the period.from month and ends at min(period.to, now)', () => {
    const now = new Date('2026-08-20T00:00:00');
    const range = netWorthFetchRange(
      {
        from: new Date('2026-07-15T00:00:00'),
        to: new Date('2026-09-01T00:00:00'),
      },
      now,
    );
    expect(range.from).toEqual(new Date(2026, 6, 1));
    expect(range.to).toEqual(now);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-net-worth-by-month.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';

export interface NetWorthPoint {
  month: Date;
  netWorth: number;
}

export function netWorthFetchRange(
  period: { from: Date; to: Date },
  now: Date = new Date(),
): { from: Date; to: Date } {
  return {
    from: new Date(period.from.getFullYear(), period.from.getMonth(), 1),
    to: period.to < now ? period.to : now,
  };
}

function isIncomeOrExpense(
  transaction: Transaction,
): transaction is Transaction & { type: 'income' | 'expense' } {
  return transaction.type === 'income' || transaction.type === 'expense';
}

/**
 * Net worth is never stored — it is reconstructed by starting at each
 * account's current balance and walking backward one calendar month at a
 * time, subtracting that month's net income/expense effect. Transfers net
 * to zero across a user's own accounts, so they're excluded.
 */
export function calculateNetWorthByMonth(
  accounts: Account[],
  transactions: Transaction[],
  period: { from: Date; to: Date },
  now: Date = new Date(),
): NetWorthPoint[] {
  const visibleAccounts = accounts.filter((account) => !account.hidden);
  const accountsById = new Map(
    visibleAccounts.map((account) => [account.id, account]),
  );
  const { from: rangeStart, to: periodEnd } = netWorthFetchRange(period, now);

  let runningNetWorth = visibleAccounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );

  const points: NetWorthPoint[] = [];
  const cursor = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

  while (cursor >= rangeStart) {
    points.unshift({ month: new Date(cursor), netWorth: runningNetWorth });

    const monthEffect = transactions
      .filter(isIncomeOrExpense)
      .filter(
        (t) =>
          t.occurredAt.getFullYear() === cursor.getFullYear() &&
          t.occurredAt.getMonth() === cursor.getMonth() &&
          accountsById.has(t.accountId),
      )
      .reduce((sum, t) => {
        const account = accountsById.get(t.accountId);
        return account ? sum + account.deltaFor(t.type, t.amount) : sum;
      }, 0);

    runningNetWorth -= monthEffect;
    cursor.setMonth(cursor.getMonth() - 1);
  }

  return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-net-worth-by-month.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire into `GetSpendingReportUseCase`**

Delete `buildNetWorthByMonth` and the module-level `isIncomeOrExpense` (lines 266-338 and 334-338). In `execute()`, fetch the transactions this calculator needs and call it:

```ts
const netWorthRange = netWorthFetchRange(period);
const netWorthTransactions = await this.transactionRepository.findByUserId(
  userId,
  {
    from: netWorthRange.from,
    to: netWorthRange.to,
    pageSize: 10000,
  },
);
const netWorthByMonth = calculateNetWorthByMonth(
  accounts,
  netWorthTransactions,
  period,
);
```

(Keep `netWorthTransactions` in a variable — Task 14 reuses it for `calculateAccountSeries` without a second fetch.)

- [ ] **Step 6: Run the existing report test suite to confirm no behavior changed**

Run: `pnpm vitest run src/modules/reports/application/get-spending-report.use-case.test.ts`
Expected: PASS — every net-worth test (backward walk, credit card inversion, hidden accounts) unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-net-worth-by-month.ts src/modules/reports/application/metrics/calculate-net-worth-by-month.test.ts src/modules/reports/application/get-spending-report.use-case.ts
git commit -m "refactor(reports): extract calculateNetWorthByMonth into a pure function"
```

---

### Task 8: Rename `GetSpendingReportUseCase` → `GetFinancialReportUseCase`

Pure mechanical rename now that every metric is a delegate call — no logic changes beyond the four already made in Tasks 4-7.

**Files:**

- Create: `src/modules/reports/application/get-financial-report.use-case.ts` (new content below)
- Create: `src/modules/reports/application/get-financial-report.use-case.test.ts` (move+rename the existing test file's content, `GetSpendingReportUseCase` → `GetFinancialReportUseCase`, `SpendingReport` → `FinancialReport`)
- Delete: `src/modules/reports/application/get-spending-report.use-case.ts`
- Delete: `src/modules/reports/application/get-spending-report.use-case.test.ts`
- Modify: `src/app/reports/page.tsx:19` (`import { GetSpendingReportUseCase } from '@/modules/reports/application/get-spending-report.use-case';` → `import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';`, and the call site `new GetSpendingReportUseCase(...)` → `new GetFinancialReportUseCase(...)`)
- Modify: `src/shared/lib/build-monthly-cash-flow.ts:12` (doc comment: `GetSpendingReportUseCase` → `GetFinancialReportUseCase`)

**Interfaces:**

- Produces: `class GetFinancialReportUseCase`, `interface FinancialReport` (renamed from `SpendingReport`), `interface ReportPeriod` (renamed from `SpendingReportPeriod`) — consumed by Task 14 (new metrics wiring) and Task 19 (page split).

- [ ] **Step 1: Create the renamed use case file**

Content is the current `get-spending-report.use-case.ts` after Tasks 4-7's extractions, with these renames: `SpendingReportPeriod` → `ReportPeriod`, `SpendingReport` → `FinancialReport`, class `GetSpendingReportUseCase` → `GetFinancialReportUseCase`. No other changes.

```ts
import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from '@/modules/budgets/application/get-budget-progress.use-case';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';
import { sumByType } from '@/shared/lib/sum-by-type';

import {
  type CategoryComparison,
  calculateCategoryComparison,
} from './metrics/calculate-category-comparison';
import {
  type CategorySpending,
  calculateCategorySpending,
} from './metrics/calculate-category-spending';
import {
  calculateNetWorthByMonth,
  type NetWorthPoint,
  netWorthFetchRange,
} from './metrics/calculate-net-worth-by-month';
import {
  calculateRecurringExpenseShare,
  type RecurringExpenseShare,
} from './metrics/calculate-recurring-expense-share';

export interface ReportPeriod {
  from: Date;
  to: Date;
}

export interface FinancialReport {
  totalIncome: number;
  totalExpense: number;
  cashFlowByMonth: MonthlyCashFlow[];
  spendingByCategory: CategorySpending[];
  netWorthByMonth: NetWorthPoint[];
  budgetsOverview: BudgetProgress[];
  categoryComparison: CategoryComparison[];
  recurringExpenseShare: RecurringExpenseShare;
}

/**
 * A read-only aggregation over existing tables. Fetches data once, then
 * delegates every computation to a pure function in `./metrics/` — see
 * docs/superpowers/specs/2026-10-16-financial-reports-center-design.md.
 */
export class GetFinancialReportUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
  ) {}

  async execute(
    userId: string,
    period: ReportPeriod,
  ): Promise<FinancialReport> {
    const periodDurationMs = period.to.getTime() - period.from.getTime();
    const previousPeriod: ReportPeriod = {
      from: new Date(period.from.getTime() - periodDurationMs - 1),
      to: new Date(period.from.getTime() - 1),
    };

    const netWorthRange = netWorthFetchRange(period);

    const [
      accounts,
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
      budgetsOverview,
      recurringRules,
      netWorthTransactions,
    ] = await Promise.all([
      this.accountRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: period.from,
        to: period.to,
        pageSize: 10000,
      }),
      this.transactionRepository.findByUserId(userId, {
        from: previousPeriod.from,
        to: previousPeriod.to,
        pageSize: 10000,
      }),
      this.categoryRepository.findByUserId(userId),
      new GetBudgetProgressUseCase(
        this.budgetRepository,
        this.transactionRepository,
      ).execute(userId),
      this.recurringTransactionRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: netWorthRange.from,
        to: netWorthRange.to,
        pageSize: 10000,
      }),
    ]);

    const totalIncome = sumByType(transactionsInPeriod, 'income');
    const totalExpense = sumByType(transactionsInPeriod, 'expense');

    const cashFlowByMonth = buildMonthlyCashFlow(
      period.from,
      period.to,
      transactionsInPeriod,
    );
    const spendingByCategory = calculateCategorySpending(
      transactionsInPeriod,
      categories,
    );
    const netWorthByMonth = calculateNetWorthByMonth(
      accounts,
      netWorthTransactions,
      period,
    );
    const categoryComparison = calculateCategoryComparison(
      transactionsInPeriod,
      previousPeriodTransactions,
      categories,
    );
    const recurringExpenseShare = calculateRecurringExpenseShare(
      recurringRules,
      totalIncome,
      period,
    );

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
}
```

- [ ] **Step 2: Create the renamed test file**

Copy `get-spending-report.use-case.test.ts`'s full content into `get-financial-report.use-case.test.ts`, then: replace the import `from './get-spending-report.use-case'` with `from './get-financial-report.use-case'`, and replace every `GetSpendingReportUseCase` with `GetFinancialReportUseCase`. No assertions change.

- [ ] **Step 3: Delete the old files**

```bash
git rm src/modules/reports/application/get-spending-report.use-case.ts src/modules/reports/application/get-spending-report.use-case.test.ts
```

- [ ] **Step 4: Update `page.tsx`'s import and call site**

In `src/app/reports/page.tsx`, replace:

```ts
import { GetSpendingReportUseCase } from '@/modules/reports/application/get-spending-report.use-case';
```

with:

```ts
import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';
```

and the call site `new GetSpendingReportUseCase(...)` with `new GetFinancialReportUseCase(...)`.

- [ ] **Step 5: Update the doc comment in `build-monthly-cash-flow.ts`**

Line 12: `GetDashboardSummaryUseCase` and `GetSpendingReportUseCase` → `GetDashboardSummaryUseCase` and `GetFinancialReportUseCase`.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS — no reference to the old names remains anywhere (`grep -rn "GetSpendingReportUseCase\|SpendingReport\b" src` returns nothing).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(reports): rename GetSpendingReportUseCase to GetFinancialReportUseCase"
```

---

## Group B — New metrics

### Task 9: `calculatePeriodComparison` + `calculateYearOverYear` + `calculateSameMonthLastYear`

One shared comparator (current-window vs previous-window → overall income/expense deltas + per-category comparison), and two thin callers that each pick a pair of date windows. Both new calculators share this task since they're a few lines each on top of the same comparator.

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-period-comparison.ts`
- Create: `src/modules/reports/application/metrics/calculate-year-over-year.ts`
- Create: `src/modules/reports/application/metrics/calculate-same-month-last-year.ts`
- Test: `src/modules/reports/application/metrics/calculate-period-comparison.test.ts`
- Test: `src/modules/reports/application/metrics/calculate-year-over-year.test.ts`
- Test: `src/modules/reports/application/metrics/calculate-same-month-last-year.test.ts`

**Interfaces:**

- Consumes: `calculateCategoryComparison` (Task 5), `calculatePeriodDelta` (Task 3), `sumByType` (Task 2).
- Produces: `interface PeriodComparison { income: PeriodDelta; expense: PeriodDelta; byCategory: CategoryComparison[] }`, `calculatePeriodComparison(currentTransactions, previousTransactions, categories): PeriodComparison`, `calculateYearOverYear(transactions: Transaction[], categories, now?: Date): PeriodComparison`, `calculateSameMonthLastYear(transactions: Transaction[], categories, referenceDate?: Date): PeriodComparison` — used by Task 14 (orchestrator) and Task 21 (comparisons section).

- [ ] **Step 1: Write the failing tests**

```ts
// calculate-period-comparison.test.ts
import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculatePeriodComparison } from './calculate-period-comparison';

function tx(type: Transaction['type'], amount: number, categoryId?: string) {
  return new Transaction({
    id: `${type}-${amount}-${categoryId ?? 'none'}`,
    accountId: 'acc-1',
    description: 'x',
    categoryId,
    amount,
    type,
    occurredAt: new Date('2026-01-01T00:00:00'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculatePeriodComparison', () => {
  it('computes income and expense deltas plus the per-category breakdown', () => {
    const current = [tx('income', 2000), tx('expense', 300, 'cat-1')];
    const previous = [tx('income', 1500), tx('expense', 200, 'cat-1')];
    const result = calculatePeriodComparison(current, previous, [
      { id: 'cat-1', name: 'Alimentação' },
    ]);
    expect(result.income).toEqual({
      currentTotal: 2000,
      previousTotal: 1500,
      deltaPercent: (500 / 1500) * 100,
    });
    expect(result.expense).toEqual({
      currentTotal: 300,
      previousTotal: 200,
      deltaPercent: 50,
    });
    expect(result.byCategory[0]).toMatchObject({
      categoryId: 'cat-1',
      currentTotal: 300,
      previousTotal: 200,
    });
  });

  it('returns deltaPercent: null for income/expense when the previous window is empty', () => {
    const result = calculatePeriodComparison([tx('income', 100)], [], []);
    expect(result.income.deltaPercent).toBeNull();
    expect(result.expense).toEqual({
      currentTotal: 0,
      previousTotal: 0,
      deltaPercent: null,
    });
  });
});
```

```ts
// calculate-year-over-year.test.ts
import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculateYearOverYear } from './calculate-year-over-year';

function tx(
  id: string,
  type: Transaction['type'],
  amount: number,
  occurredAt: Date,
) {
  return new Transaction({
    id,
    accountId: 'acc-1',
    description: 'x',
    amount,
    type,
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateYearOverYear', () => {
  it('compares Jan 1-to-now of this year against the same Jan 1-to-same-day window last year', () => {
    const now = new Date('2026-10-16T12:00:00');
    const transactions = [
      tx('t1', 'income', 1000, new Date('2026-05-01T00:00:00')), // inside this year's window
      tx('t2', 'income', 100, new Date('2026-11-01T00:00:00')), // after "now" -> excluded
      tx('t3', 'income', 700, new Date('2025-05-01T00:00:00')), // inside last year's window
      tx('t4', 'income', 50, new Date('2025-11-01T00:00:00')), // after last-year's cutoff day -> excluded
    ];
    const result = calculateYearOverYear(transactions, [], now);
    expect(result.income.currentTotal).toBe(1000);
    expect(result.income.previousTotal).toBe(700);
  });

  it('returns deltaPercent: null when there was no income last year', () => {
    const now = new Date('2026-10-16T12:00:00');
    const result = calculateYearOverYear(
      [tx('t1', 'income', 500, new Date('2026-05-01T00:00:00'))],
      [],
      now,
    );
    expect(result.income.deltaPercent).toBeNull();
  });
});
```

```ts
// calculate-same-month-last-year.test.ts
import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculateSameMonthLastYear } from './calculate-same-month-last-year';

function tx(
  id: string,
  type: Transaction['type'],
  amount: number,
  occurredAt: Date,
) {
  return new Transaction({
    id,
    accountId: 'acc-1',
    description: 'x',
    amount,
    type,
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateSameMonthLastYear', () => {
  it('compares the reference month against the same month number last year', () => {
    const reference = new Date('2026-10-16T12:00:00');
    const transactions = [
      tx('t1', 'expense', 400, new Date('2026-10-05T00:00:00')), // October 2026
      tx('t2', 'expense', 999, new Date('2026-09-05T00:00:00')), // different month -> excluded
      tx('t3', 'expense', 250, new Date('2025-10-20T00:00:00')), // October 2025
      tx('t4', 'expense', 10, new Date('2025-11-01T00:00:00')), // different month -> excluded
    ];
    const result = calculateSameMonthLastYear(transactions, [], reference);
    expect(result.expense.currentTotal).toBe(400);
    expect(result.expense.previousTotal).toBe(250);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-period-comparison.test.ts src/modules/reports/application/metrics/calculate-year-over-year.test.ts src/modules/reports/application/metrics/calculate-same-month-last-year.test.ts`
Expected: FAIL — none of the three modules exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// calculate-period-comparison.ts
import type { Transaction } from '@/core/entities/transaction';
import { sumByType } from '@/shared/lib/sum-by-type';

import {
  type CategoryComparison,
  calculateCategoryComparison,
} from './calculate-category-comparison';
import {
  calculatePeriodDelta,
  type PeriodDelta,
} from './calculate-period-delta';

export interface PeriodComparison {
  income: PeriodDelta;
  expense: PeriodDelta;
  byCategory: CategoryComparison[];
}

export function calculatePeriodComparison(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
): PeriodComparison {
  return {
    income: calculatePeriodDelta(
      sumByType(currentTransactions, 'income'),
      sumByType(previousTransactions, 'income'),
    ),
    expense: calculatePeriodDelta(
      sumByType(currentTransactions, 'expense'),
      sumByType(previousTransactions, 'expense'),
    ),
    byCategory: calculateCategoryComparison(
      currentTransactions,
      previousTransactions,
      categories,
    ),
  };
}
```

```ts
// calculate-year-over-year.ts
import type { Transaction } from '@/core/entities/transaction';

import {
  calculatePeriodComparison,
  type PeriodComparison,
} from './calculate-period-comparison';

/**
 * Compares the current calendar year, Jan 1 through `now`, against the same
 * Jan-1-to-same-day-of-year window last year — never a full year against a
 * partial one, so the comparison stays fair in any month.
 */
export function calculateYearOverYear(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
  now: Date = new Date(),
): PeriodComparison {
  const currentStart = new Date(now.getFullYear(), 0, 1);
  const previousStart = new Date(now.getFullYear() - 1, 0, 1);
  const previousEnd = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  const current = transactions.filter(
    (t) => t.occurredAt >= currentStart && t.occurredAt <= now,
  );
  const previous = transactions.filter(
    (t) => t.occurredAt >= previousStart && t.occurredAt <= previousEnd,
  );

  return calculatePeriodComparison(current, previous, categories);
}
```

```ts
// calculate-same-month-last-year.ts
import type { Transaction } from '@/core/entities/transaction';

import {
  calculatePeriodComparison,
  type PeriodComparison,
} from './calculate-period-comparison';

/** Compares the calendar month containing `referenceDate` against the same month number last year. */
export function calculateSameMonthLastYear(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
  referenceDate: Date = new Date(),
): PeriodComparison {
  const month = referenceDate.getMonth();
  const currentStart = new Date(referenceDate.getFullYear(), month, 1);
  const currentEnd = new Date(
    referenceDate.getFullYear(),
    month + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const previousStart = new Date(referenceDate.getFullYear() - 1, month, 1);
  const previousEnd = new Date(
    referenceDate.getFullYear() - 1,
    month + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const current = transactions.filter(
    (t) => t.occurredAt >= currentStart && t.occurredAt <= currentEnd,
  );
  const previous = transactions.filter(
    (t) => t.occurredAt >= previousStart && t.occurredAt <= previousEnd,
  );

  return calculatePeriodComparison(current, previous, categories);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-period-comparison.test.ts src/modules/reports/application/metrics/calculate-year-over-year.test.ts src/modules/reports/application/metrics/calculate-same-month-last-year.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-period-comparison.ts src/modules/reports/application/metrics/calculate-year-over-year.ts src/modules/reports/application/metrics/calculate-same-month-last-year.ts src/modules/reports/application/metrics/calculate-period-comparison.test.ts src/modules/reports/application/metrics/calculate-year-over-year.test.ts src/modules/reports/application/metrics/calculate-same-month-last-year.test.ts
git commit -m "feat(reports): add year-over-year and same-month-last-year comparisons"
```

---

### Task 10: `calculateAccountSeries`

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-account-series.ts`
- Test: `src/modules/reports/application/metrics/calculate-account-series.test.ts`

**Interfaces:**

- Consumes: `calculateNetWorthByMonth` (Task 7), `buildMonthlyCashFlow` (existing).
- Produces: `interface AccountSeries { accountId: string; accountName: string; balanceByMonth: NetWorthPoint[]; cashFlowByMonth: MonthlyCashFlow[] }`, `calculateAccountSeries(accounts: Account[], transactions: Transaction[], period: ReportPeriod, now?: Date): AccountSeries[]` — used by Task 14 and Task 20.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';

import { calculateAccountSeries } from './calculate-account-series';

function account(id: string, balance: number, hidden = false) {
  return new Account({
    id,
    userId: 'u1',
    name: id,
    type: 'checking',
    balance,
    currency: 'BRL',
    archived: false,
    hidden,
    createdAt: new Date('2026-01-01T00:00:00'),
    updatedAt: new Date('2026-01-01T00:00:00'),
  });
}

function tx(
  accountId: string,
  type: Transaction['type'],
  amount: number,
  occurredAt: Date,
) {
  return new Transaction({
    id: `${accountId}-${type}-${amount}-${occurredAt.toISOString()}`,
    accountId,
    description: 'x',
    amount,
    type,
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateAccountSeries', () => {
  it('returns one series per visible account, scoped to that account only', () => {
    const now = new Date('2026-08-20T00:00:00');
    const accounts = [account('acc-1', 1000), account('acc-2', 500)];
    const transactions = [
      tx('acc-1', 'expense', 100, new Date('2026-08-10T00:00:00')),
      tx('acc-2', 'income', 50, new Date('2026-08-10T00:00:00')),
    ];
    const period = {
      from: new Date('2026-07-01T00:00:00'),
      to: new Date('2026-08-20T00:00:00'),
    };

    const series = calculateAccountSeries(accounts, transactions, period, now);

    expect(series).toHaveLength(2);
    const acc1 = series.find((s) => s.accountId === 'acc-1')!;
    expect(acc1.balanceByMonth.at(-1)).toMatchObject({ netWorth: 1000 });
    expect(acc1.balanceByMonth.at(-2)).toMatchObject({ netWorth: 1100 }); // before the 100 expense
    expect(acc1.cashFlowByMonth.at(-1)).toMatchObject({
      income: 0,
      expense: 100,
    });
  });

  it('excludes hidden accounts entirely, not just zeroing them', () => {
    const now = new Date('2026-08-20T00:00:00');
    const accounts = [account('visible', 100), account('hidden', 5000, true)];
    const period = {
      from: new Date('2026-08-01T00:00:00'),
      to: new Date('2026-08-20T00:00:00'),
    };

    const series = calculateAccountSeries(accounts, [], period, now);

    expect(series).toHaveLength(1);
    expect(series[0].accountId).toBe('visible');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-account-series.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';

import {
  calculateNetWorthByMonth,
  type NetWorthPoint,
} from './calculate-net-worth-by-month';

export interface AccountSeries {
  accountId: string;
  accountName: string;
  balanceByMonth: NetWorthPoint[];
  cashFlowByMonth: MonthlyCashFlow[];
}

export function calculateAccountSeries(
  accounts: Account[],
  transactions: Transaction[],
  period: { from: Date; to: Date },
  now: Date = new Date(),
): AccountSeries[] {
  return accounts
    .filter((account) => !account.hidden)
    .map((account) => {
      const accountTransactions = transactions.filter(
        (t) => t.accountId === account.id,
      );
      return {
        accountId: account.id,
        accountName: account.name,
        balanceByMonth: calculateNetWorthByMonth(
          [account],
          accountTransactions,
          period,
          now,
        ),
        cashFlowByMonth: buildMonthlyCashFlow(
          period.from,
          period.to,
          accountTransactions,
        ),
      };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-account-series.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-account-series.ts src/modules/reports/application/metrics/calculate-account-series.test.ts
git commit -m "feat(reports): add calculateAccountSeries for the per-account breakdown"
```

---

### Task 11: `calculateTrendStats`

**Files:**

- Create: `src/modules/reports/application/metrics/calculate-trend-stats.ts`
- Test: `src/modules/reports/application/metrics/calculate-trend-stats.test.ts`

**Interfaces:**

- Consumes: `resolveCategoryName`, `UNCATEGORIZED_KEY` (Task 1).
- Produces: `type TrendDirection = 'subindo' | 'caindo' | 'estável' | 'insuficiente'`, `interface CategoryTrendStats { categoryId: string; categoryName: string; average: number; median: number; trend: TrendDirection }`, `calculateTrendStats(transactions: Transaction[], categories: Array<{ id: string; name: string }>, period: ReportPeriod): CategoryTrendStats[]` — used by Task 14 and Task 21.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Transaction } from '@/core/entities/transaction';

import { calculateTrendStats } from './calculate-trend-stats';

function tx(categoryId: string, amount: number, occurredAt: Date) {
  return new Transaction({
    id: `${categoryId}-${amount}-${occurredAt.toISOString()}`,
    accountId: 'acc-1',
    description: 'x',
    categoryId,
    amount,
    type: 'expense',
    occurredAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('calculateTrendStats', () => {
  it('computes average/median and a rising trend over a clearly increasing series', () => {
    const transactions = [
      tx('cat-1', 100, new Date('2026-06-05T00:00:00')),
      tx('cat-1', 200, new Date('2026-07-05T00:00:00')),
      tx('cat-1', 300, new Date('2026-08-05T00:00:00')),
    ];
    const period = {
      from: new Date('2026-06-01T00:00:00'),
      to: new Date('2026-08-31T00:00:00'),
    };

    const [stats] = calculateTrendStats(
      transactions,
      [{ id: 'cat-1', name: 'Alimentação' }],
      period,
    );

    expect(stats.average).toBe(200);
    expect(stats.median).toBe(200);
    expect(stats.trend).toBe('subindo');
  });

  it('returns "insuficiente" when fewer than 2 months have data', () => {
    const transactions = [tx('cat-1', 100, new Date('2026-08-05T00:00:00'))];
    const period = {
      from: new Date('2026-08-01T00:00:00'),
      to: new Date('2026-08-31T00:00:00'),
    };

    const [stats] = calculateTrendStats(
      transactions,
      [{ id: 'cat-1', name: 'Alimentação' }],
      period,
    );

    expect(stats.trend).toBe('insuficiente');
  });

  it('returns "estável" when spending barely changes month to month', () => {
    const transactions = [
      tx('cat-1', 100, new Date('2026-06-05T00:00:00')),
      tx('cat-1', 101, new Date('2026-07-05T00:00:00')),
      tx('cat-1', 99, new Date('2026-08-05T00:00:00')),
    ];
    const period = {
      from: new Date('2026-06-01T00:00:00'),
      to: new Date('2026-08-31T00:00:00'),
    };

    const [stats] = calculateTrendStats(
      transactions,
      [{ id: 'cat-1', name: 'Alimentação' }],
      period,
    );

    expect(stats.trend).toBe('estável');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-trend-stats.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Transaction } from '@/core/entities/transaction';

import { resolveCategoryName, UNCATEGORIZED_KEY } from './category-key';

export type TrendDirection = 'subindo' | 'caindo' | 'estável' | 'insuficiente';

export interface CategoryTrendStats {
  categoryId: string;
  categoryName: string;
  average: number;
  median: number;
  trend: TrendDirection;
}

const TREND_THRESHOLD = 0.05; // 5% of the average per month — below this, call it flat.

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function classifyTrend(monthlyTotals: number[]): TrendDirection {
  if (monthlyTotals.length < 2) return 'insuficiente';

  const n = monthlyTotals.length;
  const xMean = (n - 1) / 2;
  const yMean = monthlyTotals.reduce((sum, v) => sum + v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (monthlyTotals[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;

  if (yMean === 0)
    return slope === 0 ? 'estável' : slope > 0 ? 'subindo' : 'caindo';
  const relativeSlope = slope / yMean;
  if (relativeSlope > TREND_THRESHOLD) return 'subindo';
  if (relativeSlope < -TREND_THRESHOLD) return 'caindo';
  return 'estável';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function calculateTrendStats(
  transactions: Transaction[],
  categories: Array<{ id: string; name: string }>,
  period: { from: Date; to: Date },
): CategoryTrendStats[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  // categoryId -> monthKey -> total
  const totalsByCategory = new Map<string, Map<string, number>>();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const categoryId = transaction.categoryId ?? UNCATEGORIZED_KEY;
    const key = monthKey(transaction.occurredAt);
    const monthly =
      totalsByCategory.get(categoryId) ?? new Map<string, number>();
    monthly.set(key, (monthly.get(key) ?? 0) + transaction.amount);
    totalsByCategory.set(categoryId, monthly);
  }

  return [...totalsByCategory.entries()].map(([categoryId, monthly]) => {
    const monthlyTotals = [...monthly.values()];
    return {
      categoryId,
      categoryName: resolveCategoryName(categoryId, categoriesById),
      average:
        monthlyTotals.reduce((sum, v) => sum + v, 0) / monthlyTotals.length,
      median: median(monthlyTotals),
      trend: classifyTrend(monthlyTotals),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/metrics/calculate-trend-stats.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/application/metrics/calculate-trend-stats.ts src/modules/reports/application/metrics/calculate-trend-stats.test.ts
git commit -m "feat(reports): add calculateTrendStats (average/median/trend per category)"
```

---

### Task 12: Wire all four new metrics into `GetFinancialReportUseCase`

**Files:**

- Modify: `src/modules/reports/application/get-financial-report.use-case.ts`
- Modify: `src/modules/reports/application/get-financial-report.use-case.test.ts` (add assertions for the four new fields)

**Interfaces:**

- Consumes: `calculateAccountSeries` (Task 10), `calculateYearOverYear`/`calculateSameMonthLastYear` (Task 9), `calculateTrendStats` (Task 11).
- Produces: `FinancialReport` now also has `accountSeries: AccountSeries[]`, `yearOverYear: PeriodComparison`, `sameMonthLastYear: PeriodComparison`, `trendStats: CategoryTrendStats[]` — consumed by Task 19-21 (sections) and Task 22 (CSV export).

`execute()` currently computes nothing time-anchored at all — `period.from`/`period.to` come entirely from the caller. YoY and same-month-last-year are different: they're anchored to "now" (spec §3.5), and "now" must be injectable, exactly like every pure calculator in this plan already takes an optional `now: Date = new Date()`. Without that, this task's own test would depend on the real wall-clock date relative to fixed transaction dates — add it as `execute`'s third parameter now, before writing a test that would otherwise be non-deterministic.

- [ ] **Step 1: Write the failing test additions**

Append to `get-financial-report.use-case.test.ts`. `now` is pinned to a fixed instant so every assertion below is exact and reproducible regardless of when the test actually runs.

```ts
describe('GetFinancialReportUseCase — new metrics', () => {
  it('includes accountSeries, yearOverYear, sameMonthLastYear and trendStats in the report', async () => {
    const { useCase, accountRepository, transactionRepository } =
      await buildUseCase();
    const now = new Date('2026-08-20T00:00:00');
    await accountRepository.save(makeAccount({ balance: 1000 }));
    await transactionRepository.save(
      makeTransaction({
        id: 'tx-1',
        type: 'expense',
        amount: 50,
        occurredAt: new Date('2026-08-05T00:00:00'),
      }),
    );

    const report = await useCase.execute(
      USER_ID,
      {
        from: new Date('2026-08-01T00:00:00'),
        to: new Date('2026-08-31T23:59:59'),
      },
      now,
    );

    expect(report.accountSeries).toHaveLength(1);
    expect(report.accountSeries[0].accountId).toBe('acc-1');

    // yearOverYear/sameMonthLastYear both cover Jan 1(or Aug 1) 2026 through `now` for
    // "current" and the equivalent 2025 window for "previous" — the one expense (no
    // category -> 'uncategorized') falls inside "current" and has no 2025 counterpart,
    // so previousTotal is 0 and deltaPercent is null, not NaN:
    expect(report.yearOverYear.expense).toMatchObject({
      currentTotal: 50,
      previousTotal: 0,
      deltaPercent: null,
    });
    expect(report.yearOverYear.byCategory).toEqual([
      {
        categoryId: 'uncategorized',
        categoryName: 'Sem categoria',
        currentTotal: 50,
        previousTotal: 0,
        deltaPercent: null,
      },
    ]);
    expect(report.sameMonthLastYear.expense).toMatchObject({
      currentTotal: 50,
      previousTotal: 0,
      deltaPercent: null,
    });

    // calculateTrendStats always returns one entry per category it saw spending for,
    // even with too little data to classify a trend — it marks that case 'insuficiente'
    // rather than omitting the category, so this 1-month-only category still shows up:
    expect(report.trendStats).toEqual([
      {
        categoryId: 'uncategorized',
        categoryName: 'Sem categoria',
        average: 50,
        median: 50,
        trend: 'insuficiente',
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/get-financial-report.use-case.test.ts`
Expected: FAIL — `execute` doesn't accept a third argument yet, and `report.accountSeries` is `undefined`.

- [ ] **Step 3: Wire the four calculators into `execute()`**

Add imports:

```ts
import {
  calculateAccountSeries,
  type AccountSeries,
} from './metrics/calculate-account-series';
import { calculateSameMonthLastYear } from './metrics/calculate-same-month-last-year';
import {
  calculateTrendStats,
  type CategoryTrendStats,
} from './metrics/calculate-trend-stats';
import { calculateYearOverYear } from './metrics/calculate-year-over-year';
import type { PeriodComparison } from './metrics/calculate-period-comparison';
```

Extend `FinancialReport`:

```ts
export interface FinancialReport {
  totalIncome: number;
  totalExpense: number;
  cashFlowByMonth: MonthlyCashFlow[];
  spendingByCategory: CategorySpending[];
  netWorthByMonth: NetWorthPoint[];
  budgetsOverview: BudgetProgress[];
  categoryComparison: CategoryComparison[];
  recurringExpenseShare: RecurringExpenseShare;
  accountSeries: AccountSeries[];
  yearOverYear: PeriodComparison;
  sameMonthLastYear: PeriodComparison;
  trendStats: CategoryTrendStats[];
}
```

Add `now` as `execute`'s third parameter, defaulting to `new Date()` so every pre-existing caller (`page.tsx`, the export route) keeps working unchanged while tests can pin it:

```ts
async execute(
  userId: string,
  period: ReportPeriod,
  now: Date = new Date(),
): Promise<FinancialReport> {
```

This also makes every "anchored to now" calculation in this call (net worth's implicit cutoff, account series, YoY, same-month) agree on the exact same instant, instead of each defaulting to its own separately-computed `new Date()`. Right after the existing `previousPeriod` calculation, add:

```ts
const netWorthRange = netWorthFetchRange(period, now);
const yoyWindowStart = new Date(now.getFullYear() - 1, 0, 1);
```

(This replaces the `const netWorthRange = netWorthFetchRange(period);` line already there from Task 7 — same call, now with `now` threaded through explicitly.)

Add one more fetch for the YoY/same-month window (anchored to `now`, independent of `period`):

```ts
const yoyTransactions = await this.transactionRepository.findByUserId(userId, {
  from: yoyWindowStart,
  to: now,
  pageSize: 10000,
});
```

(Add `yoyTransactions` as one more entry in the existing `Promise.all([...])` array rather than a separate `await`, to keep the parallel-fetch pattern already used for everything else.)

Update the net-worth call site Task 7 added to pass `now` explicitly too:

```ts
const netWorthByMonth = calculateNetWorthByMonth(
  accounts,
  netWorthTransactions,
  period,
  now,
);
```

Then, after the existing metric calls:

```ts
const accountSeries = calculateAccountSeries(
  accounts,
  netWorthTransactions,
  period,
  now,
);
const yearOverYear = calculateYearOverYear(yoyTransactions, categories, now);
const sameMonthLastYear = calculateSameMonthLastYear(
  yoyTransactions,
  categories,
  now,
);
const trendStats = calculateTrendStats(
  transactionsInPeriod,
  categories,
  period,
);
```

And add all four to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/get-financial-report.use-case.test.ts`
Expected: PASS — including the new describe block.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm vitest run && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/reports/application/get-financial-report.use-case.ts src/modules/reports/application/get-financial-report.use-case.test.ts
git commit -m "feat(reports): wire account series, YoY, same-month and trend stats into the report"
```

---

## Group C — Chart infrastructure

### Task 13: Categorical chart colors + `recharts` dependency + shared tooltip content

Palette validated against this project's actual card surfaces (light `#fbfdfe`, dark `#10294a`) with the dataviz skill's validator — see chat transcript for the run. Six slots, both modes pass every hard gate; light mode has a contrast WARN on 3 slots, which the "Outros"-aware legend (Task 16) already satisfies by always printing the amount as text next to the swatch.

**Files:**

- Modify: `src/app/globals.css` (add 6 new vars per theme + `@theme inline` mapping)
- Create: `src/shared/constants/chart-colors.ts`
- Create: `src/shared/lib/split-past-limit.ts`
- Test: `src/shared/lib/split-past-limit.test.ts`
- Modify: `package.json` (add `recharts: ^3.10.1`)
- Create: `src/components/ui/chart-tooltip.tsx`

**Interfaces (added by this task):**

- Produces: `splitPastLimit<T>(items: T[], limit: number): { head: T[]; tail: T[] }` — used by Task 16 (category donut) and Task 19 (account lines) to decide, in a tested pure function, exactly where a categorical series folds into "Outros" instead of generating a 7th hue.

- [ ] **Step 1: Add the categorical CSS variables**

In `src/app/globals.css`, inside `:root` (after `--info-foreground`, line 45):

```css
--chart-1: #2a78d6;
--chart-2: #eb6834;
--chart-3: #1baf7a;
--chart-4: #eda100;
--chart-5: #e87ba4;
--chart-6: #4a3aa7;
```

Inside `.dark` (after `--info-foreground`, line 87):

```css
--chart-1: #3987e5;
--chart-2: #d95926;
--chart-3: #199e70;
--chart-4: #c98500;
--chart-5: #d55181;
--chart-6: #9085e9;
```

Inside `@theme inline` (after `--color-info-foreground`, line 126):

```css
--color-chart-1: var(--chart-1);
--color-chart-2: var(--chart-2);
--color-chart-3: var(--chart-3);
--color-chart-4: var(--chart-4);
--color-chart-5: var(--chart-5);
--color-chart-6: var(--chart-6);
```

- [ ] **Step 2: Add the shared color constants**

```ts
// src/shared/constants/chart-colors.ts

/**
 * Six-slot categorical palette, validated (dataviz skill's validate_palette.js)
 * against this project's own light/dark card surfaces — worst adjacent CVD
 * ΔE 9.1 light / 8.4 dark, worst adjacent normal-vision ΔE 19.6 light / 19.3
 * dark. Never add a 7th slot or cycle these — fold anything past slot 6 into
 * "Outros" instead (see CHART_OTHER_COLOR).
 */
export const CHART_CATEGORICAL_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
] as const;

export const CHART_OTHER_LABEL = 'Outros';
export const CHART_OTHER_COLOR = 'var(--muted-foreground)';

export const CHART_INCOME_COLOR = 'var(--success)';
export const CHART_EXPENSE_COLOR = 'var(--destructive)';
export const CHART_PRIMARY_COLOR = 'var(--primary)';

export const CHART_GRID_COLOR = 'var(--border)';
export const CHART_AXIS_TEXT_COLOR = 'var(--muted-foreground)';
```

- [ ] **Step 2b: Write `splitPastLimit` and its test**

```ts
// src/shared/lib/split-past-limit.test.ts
import { describe, expect, it } from 'vitest';

import { splitPastLimit } from './split-past-limit';

describe('splitPastLimit', () => {
  it('returns everything as head when the list is within the limit', () => {
    expect(splitPastLimit([1, 2, 3], 6)).toEqual({ head: [1, 2, 3], tail: [] });
  });

  it('keeps exactly limit-1 items in head and folds the rest into tail, past the limit', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const result = splitPastLimit(items, 6);
    expect(result.head).toEqual([1, 2, 3, 4, 5]);
    expect(result.tail).toEqual([6, 7]);
  });

  it('treats a list exactly at the limit as all head, no fold', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(splitPastLimit(items, 6)).toEqual({ head: items, tail: [] });
  });
});
```

```ts
// src/shared/lib/split-past-limit.ts
/**
 * Splits a categorical series so at most `limit` identities are ever shown
 * individually — the (limit)th slot onward folds into a single "Outros"
 * bucket instead of generating or cycling a new hue (dataviz non-negotiable:
 * never invent a categorical color past a validated palette's slot count).
 */
export function splitPastLimit<T>(
  items: T[],
  limit: number,
): { head: T[]; tail: T[] } {
  if (items.length <= limit) return { head: items, tail: [] };
  return { head: items.slice(0, limit - 1), tail: items.slice(limit - 1) };
}
```

Run: `pnpm vitest run src/shared/lib/split-past-limit.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 3: Add the `recharts` dependency**

```bash
pnpm add recharts@^3.10.1
```

(Confirm `package.json`'s `dependencies` now lists `"recharts": "^3.10.1"`.)

- [ ] **Step 4: Add the shared tooltip content component**

Recharts' `<Tooltip>` takes a `content` render-prop; this wraps it once so every chart gets the same themed box (card surface, border, text tokens) instead of Recharts' default white box.

```tsx
'use client';

import type { TooltipProps } from 'recharts';

import { formatCurrency } from '@/shared/lib/format-currency';

export function ChartTooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="border-border bg-card rounded-md border p-3 text-sm shadow-lg">
      {label !== undefined && (
        <p className="text-muted-foreground mb-1.5 text-xs capitalize">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="dimension-figure ml-auto font-semibold">
              {formatCurrency(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/shared/constants/chart-colors.ts src/shared/lib/split-past-limit.ts src/shared/lib/split-past-limit.test.ts src/components/ui/chart-tooltip.tsx package.json pnpm-lock.yaml
git commit -m "feat(reports): add recharts, categorical chart palette, and themed tooltip"
```

---

### Task 14: Net worth chart (diverging bar)

Net worth over time is a single series that can cross zero — per the dataviz skill's form table, "above/below a baseline" is a **diverging bar**, not a line, which is also exactly what the hand-rolled bars already did (`bg-primary` when ≥0, `bg-destructive` when <0). This task ports that same visual logic to Recharts with a working tooltip, replacing the manual `<div>` bars at `page.tsx:132-171`.

**Files:**

- Create: `src/components/reports/net-worth-chart.tsx`

**Interfaces:**

- Consumes: `NetWorthPoint[]` (from `calculate-net-worth-by-month.ts`, Task 7).
- Produces: `<NetWorthChart points={NetWorthPoint[]} />` — consumed by Task 19 (overview section).

- [ ] **Step 1: Write the component**

```tsx
'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { NetWorthPoint } from '@/modules/reports/application/metrics/calculate-net-worth-by-month';
import {
  CHART_EXPENSE_COLOR,
  CHART_GRID_COLOR,
  CHART_PRIMARY_COLOR,
} from '@/shared/constants/chart-colors';
import { formatMonthLabel } from '@/shared/lib/format-date';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';

interface NetWorthChartProps {
  points: NetWorthPoint[];
}

export function NetWorthChart({ points }: NetWorthChartProps) {
  const data = points.map((point) => ({
    month: formatMonthLabel(point.month),
    netWorth: point.netWorth,
  }));

  return (
    <BarChart
      width={undefined as unknown as number}
      height={224}
      data={data}
      className="h-56 w-full"
    >
      <CartesianGrid
        stroke={CHART_GRID_COLOR}
        strokeDasharray="0"
        vertical={false}
      />
      <XAxis
        dataKey="month"
        tick={{ fontSize: 12 }}
        axisLine={{ stroke: CHART_GRID_COLOR }}
        tickLine={false}
      />
      <YAxis hide />
      <ReferenceLine y={0} stroke={CHART_GRID_COLOR} />
      <Tooltip
        content={<ChartTooltipContent />}
        cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
      />
      <Bar
        dataKey="netWorth"
        name="Patrimônio"
        radius={[4, 4, 0, 0]}
        maxBarSize={24}
      >
        {data.map((entry) => (
          <Cell
            key={entry.month}
            fill={
              entry.netWorth >= 0 ? CHART_PRIMARY_COLOR : CHART_EXPENSE_COLOR
            }
          />
        ))}
      </Bar>
    </BarChart>
  );
}
```

(`width={undefined as unknown as number}` plus the `w-full` class is intentional: Recharts' bare `BarChart` needs numeric `width`/`height` unless wrapped in `ResponsiveContainer`. Use `ResponsiveContainer` instead — see Step 2.)

- [ ] **Step 2: Fix the sizing — wrap in `ResponsiveContainer`**

Replace the bare `<BarChart>` return with:

```tsx
return (
  <div className="h-56 w-full">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid
          stroke={CHART_GRID_COLOR}
          strokeDasharray="0"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          axisLine={{ stroke: CHART_GRID_COLOR }}
          tickLine={false}
        />
        <YAxis hide />
        <ReferenceLine y={0} stroke={CHART_GRID_COLOR} />
        <Tooltip
          content={<ChartTooltipContent />}
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
        />
        <Bar
          dataKey="netWorth"
          name="Patrimônio"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        >
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={
                entry.netWorth >= 0 ? CHART_PRIMARY_COLOR : CHART_EXPENSE_COLOR
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);
```

Add `ResponsiveContainer` to the import line: `import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';`. Delete the first bare-`BarChart` version from Step 1 entirely — this is the final component body.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/net-worth-chart.tsx
git commit -m "feat(reports): add NetWorthChart (diverging bar, Recharts)"
```

---

### Task 15: Cash flow chart (grouped bar, income vs expense)

Replaces the hand-rolled two-series bars at `page.tsx:175-230`. Income/expense is a good/bad binary, not generic category identity, so it keeps the project's existing status colors (`--success`/`--destructive`) rather than the categorical palette.

**Files:**

- Create: `src/components/reports/cash-flow-chart.tsx`

**Interfaces:**

- Consumes: `MonthlyCashFlow[]` (from `@/shared/lib/build-monthly-cash-flow`).
- Produces: `<CashFlowChart months={MonthlyCashFlow[]} />` — consumed by Task 19.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';
import type { MonthlyCashFlow } from '@/shared/lib/build-monthly-cash-flow';
import {
  CHART_EXPENSE_COLOR,
  CHART_GRID_COLOR,
  CHART_INCOME_COLOR,
} from '@/shared/constants/chart-colors';
import { formatMonthLabel } from '@/shared/lib/format-date';

interface CashFlowChartProps {
  months: MonthlyCashFlow[];
}

export function CashFlowChart({ months }: CashFlowChartProps) {
  const data = months.map((month) => ({
    month: formatMonthLabel(month.month),
    Receitas: month.income,
    Despesas: month.expense,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid
            stroke={CHART_GRID_COLOR}
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="Receitas"
            fill={CHART_INCOME_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
          <Bar
            dataKey="Despesas"
            fill={CHART_EXPENSE_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/cash-flow-chart.tsx
git commit -m "feat(reports): add CashFlowChart (grouped bar, Recharts)"
```

---

### Task 16: Category spending chart (donut + legend)

Replaces the ranked CSS-bar list at `page.tsx:237-275`. A donut needs categorical identity per slice (unlike the single red-ink convention the ranked list used), so it draws from `CHART_CATEGORICAL_COLORS` and folds any category past the 6th into a single "Outros" slice — never generating a 7th hue. The legend always prints the amount as text (the "relief rule" for the 3 light-mode slots that sit under 3:1 contrast).

**Files:**

- Create: `src/components/reports/category-spending-chart.tsx`

**Interfaces:**

- Consumes: `CategorySpending[]` (from `calculate-category-spending.ts`, Task 4) — already sorted descending by `total`.
- Produces: `<CategorySpendingChart categories={CategorySpending[]} />` — consumed by Task 19.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import type { CategorySpending } from '@/modules/reports/application/metrics/calculate-category-spending';
import {
  CHART_CATEGORICAL_COLORS,
  CHART_OTHER_COLOR,
  CHART_OTHER_LABEL,
} from '@/shared/constants/chart-colors';
import { formatCurrency } from '@/shared/lib/format-currency';
import { splitPastLimit } from '@/shared/lib/split-past-limit';

interface CategorySpendingChartProps {
  categories: CategorySpending[];
}

const MAX_SLICES = CHART_CATEGORICAL_COLORS.length;

function foldIntoSlices(categories: CategorySpending[]) {
  const { head, tail } = splitPastLimit(categories, MAX_SLICES);
  const slicedHead = head.map((c, i) => ({
    ...c,
    color: CHART_CATEGORICAL_COLORS[i],
  }));
  if (tail.length === 0) return slicedHead;
  const otherTotal = tail.reduce((sum, c) => sum + c.total, 0);
  return [
    ...slicedHead,
    {
      categoryId: 'other',
      categoryName: CHART_OTHER_LABEL,
      total: otherTotal,
      color: CHART_OTHER_COLOR,
    },
  ];
}

export function CategorySpendingChart({
  categories,
}: CategorySpendingChartProps) {
  if (categories.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhuma despesa registrada neste período.
      </p>
    );
  }

  const slices = foldIntoSlices(categories);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-48 w-full sm:w-48 sm:flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="categoryName"
              innerRadius="60%"
              outerRadius="90%"
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.categoryId}
                  fill={slice.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => (
          <div
            key={slice.categoryId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              {slice.categoryName}
            </span>
            <span className="dimension-figure flex-shrink-0 font-semibold">
              {formatCurrency(slice.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/category-spending-chart.tsx
git commit -m "feat(reports): add CategorySpendingChart (donut, folds past 6 categories into Outros)"
```

---

## Group D — Page restructure (tabs) + new sections

### Task 17: Shared `defaultPeriod` helper + tabs navigation

Extracts `DEFAULT_PERIOD_MONTHS`/`defaultPeriod()` out of `page.tsx` so the export route (Task 23) doesn't duplicate it, and adds the tabs nav — following the project's existing convention of query-param-driven, server-rendered navigation (same pattern as the `from`/`to` filter form already in `page.tsx`), not a new client-side widget.

**Files:**

- Create: `src/modules/reports/default-period.ts`
- Create: `src/app/reports/report-tabs-nav.tsx`
- Modify: `src/app/reports/page.tsx` (remove the now-duplicated `DEFAULT_PERIOD_MONTHS`/`defaultPeriod`, import the shared one; this task does not yet move the Visão Geral content — that's Task 19)

**Interfaces:**

- Produces: `defaultPeriod(): { from: Date; to: Date }`, `<ReportTabsNav activeTab={'overview' | 'accounts' | 'comparisons'} queryString={string} />` — consumed by Tasks 19-21, 23.

- [ ] **Step 1: Extract `defaultPeriod`**

```ts
// src/modules/reports/default-period.ts
const DEFAULT_PERIOD_MONTHS = 6;

export function defaultPeriod(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(
    now.getFullYear(),
    now.getMonth() - (DEFAULT_PERIOD_MONTHS - 1),
    1,
  );
  return { from, to: now };
}
```

In `page.tsx`, delete the local `DEFAULT_PERIOD_MONTHS` const and `defaultPeriod` function (lines 24, 30-38), and add `import { defaultPeriod } from '@/modules/reports/default-period';`.

- [ ] **Step 2: Write the tabs nav**

```tsx
import Link from 'next/link';

import { cn } from '@/shared/lib/cn';

export type ReportTab = 'overview' | 'accounts' | 'comparisons';

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'accounts', label: 'Por conta' },
  { id: 'comparisons', label: 'Comparações' },
];

interface ReportTabsNavProps {
  activeTab: ReportTab;
  /** The current `from`/`to` query string (without `tab`), so switching tabs keeps the selected period. */
  periodQueryString: string;
}

export function ReportTabsNav({
  activeTab,
  periodQueryString,
}: ReportTabsNavProps) {
  return (
    <nav className="border-border flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`?${periodQueryString}&tab=${tab.id}`}
          className={cn(
            'rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'border-primary text-primary border-b-2'
              : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS — `page.tsx` still compiles (the nav isn't rendered yet; that's Task 19).

- [ ] **Step 4: Commit**

```bash
git add src/modules/reports/default-period.ts src/app/reports/report-tabs-nav.tsx src/app/reports/page.tsx
git commit -m "refactor(reports): extract defaultPeriod helper, add tabs navigation component"
```

---

### Task 18: Split `page.tsx` into a thin shell + `overview-section.tsx`

Moves the existing Visão Geral content (everything currently in `page.tsx`) into its own section component, swaps in the three chart components from Group C, and makes `page.tsx` itself just: auth, parse `from`/`to`/`tab`, fetch the report once, dispatch to the active section.

**Files:**

- Create: `src/app/reports/overview-section.tsx`
- Modify: `src/app/reports/page.tsx` (replace nearly all content with the thin shell below)

**Interfaces:**

- Consumes: `NetWorthChart` (Task 14), `CashFlowChart` (Task 15), `CategorySpendingChart` (Task 16), `FinancialReport` (Task 12).
- Produces: `<OverviewSection report={FinancialReport} />` — consumed by the new `page.tsx`.

- [ ] **Step 1: Write `overview-section.tsx`**

Move the existing JSX from `page.tsx:108-338` (the period summary card, net worth card, cash flow card, category spending card, budgets card, category comparison card, recurring expense card) into this new file as a function component. Replace the net worth card's inner bar-`<div>` markup with `<NetWorthChart points={report.netWorthByMonth} />`, the cash-flow card's bars with `<CashFlowChart months={report.cashFlowByMonth} />`, and the category-spending card's ranked list with `<CategorySpendingChart categories={report.spendingByCategory} />`. Everything else (budgets card, category-comparison card, recurring-expense card) is copied verbatim — those three still use the existing hand-rolled markup per spec (only net worth, cash flow, and category spending were in scope for "gráficos de verdade").

```tsx
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CashFlowChart } from '@/components/reports/cash-flow-chart';
import { CategorySpendingChart } from '@/components/reports/category-spending-chart';
import { NetWorthChart } from '@/components/reports/net-worth-chart';
import { ROUTES } from '@/config/routes';
import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

interface OverviewSectionProps {
  report: FinancialReport;
  from: Date;
  to: Date;
}

export function OverviewSection({ report, from, to }: OverviewSectionProps) {
  const overBudget = report.budgetsOverview.filter((b) => b.percentage > 1);
  const withinBudget = report.budgetsOverview.filter((b) => b.percentage <= 1);
  const growingCategories = report.categoryComparison.filter(
    (c) => c.currentTotal - c.previousTotal > 0,
  );

  return (
    <div className="space-y-6">
      <Card className="registration-frame p-6 sm:p-8">
        <p className="font-display text-muted-foreground text-sm italic">
          Relatório · {formatDate(from)} — {formatDate(to)}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm">Receitas no período</p>
            <p className="dimension-figure text-success mt-1 text-2xl font-semibold">
              {formatCurrency(report.totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Despesas no período</p>
            <p className="dimension-figure text-destructive mt-1 text-2xl font-semibold">
              {formatCurrency(report.totalExpense)}
            </p>
          </div>
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Evolução do patrimônio</CardTitle>
            <CardDescription>
              Saldo consolidado das contas visíveis, mês a mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-6 p-0">
            {report.netWorthByMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sem dados suficientes para este período.
              </p>
            ) : (
              <NetWorthChart points={report.netWorthByMonth} />
            )}
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Receitas vs. despesas</CardTitle>
            <CardDescription>
              Comparativo mensal no período selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-6 p-0">
            {report.cashFlowByMonth.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sem dados suficientes para este período.
              </p>
            ) : (
              <CashFlowChart months={report.cashFlowByMonth} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Gastos por categoria</CardTitle>
            <CardDescription>
              Despesas do período, da maior para a menor.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4 p-0">
            <CategorySpendingChart categories={report.spendingByCategory} />
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Orçamentos</CardTitle>
            <CardDescription>
              {overBudget.length > 0
                ? `${overBudget.length} acima do limite.`
                : 'Todos dentro do limite.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4 p-0">
            {report.budgetsOverview.length === 0 ? (
              <EmptyState
                title="Nenhum orçamento cadastrado."
                description="Defina limites por categoria para acompanhar seus gastos aqui."
                action={
                  <Link
                    href={ROUTES.budgets}
                    className="text-foreground text-sm underline"
                  >
                    Criar orçamento
                  </Link>
                }
              />
            ) : (
              <div className="space-y-4">
                {[...overBudget, ...withinBudget].map(
                  ({ budget, percentage, spent }) => (
                    <div key={budget.id} className="dimension-row block">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="dimension-figure">
                          {formatCurrency(spent, budget.currency)} /{' '}
                          {formatCurrency(budget.amount, budget.currency)}
                        </span>
                        <span className="text-muted-foreground dimension-figure">
                          {Math.round(percentage * 100)}%
                        </span>
                      </div>
                      <div className="bg-muted h-1.5">
                        <div
                          className={`h-1.5 ${
                            percentage > 1
                              ? 'bg-destructive'
                              : percentage >= 0.8
                                ? 'bg-warning'
                                : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(percentage, 1) * 100}%` }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">
              Comparação com o período anterior
            </CardTitle>
            <CardDescription>
              Categorias que mais cresceram em valor.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4 p-0">
            {growingCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma categoria cresceu neste período em relação ao anterior.
              </p>
            ) : (
              <div className="space-y-3">
                {growingCategories.slice(0, 5).map((comparison) => (
                  <div
                    key={comparison.categoryId}
                    className="dimension-row flex items-center justify-between"
                  >
                    <span className="text-sm">{comparison.categoryName}</span>
                    <span className="flex items-center gap-2">
                      <span className="dimension-figure text-destructive text-sm font-semibold">
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
                  <span className="dimension-figure text-2xl font-semibold">
                    {report.recurringExpenseShare.percentage.toFixed(0)}%
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatCurrency(
                      report.recurringExpenseShare.monthlyRecurringExpense,
                    )}{' '}
                    de{' '}
                    {formatCurrency(
                      report.recurringExpenseShare.averageMonthlyIncome,
                    )}
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
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Replace `page.tsx` with the thin shell**

```tsx
import { AppShell } from '@/components/layout/app-shell';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';
import { defaultPeriod } from '@/modules/reports/default-period';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

import { AccountsSection } from './accounts-section';
import { ComparisonsSection } from './comparisons-section';
import { ExportButtons } from './export-buttons';
import { OverviewSection } from './overview-section';
import { type ReportTab, ReportTabsNav } from './report-tabs-nav';

interface ReportsPageProps {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseTab(value: string | undefined): ReportTab {
  return value === 'accounts' || value === 'comparisons' ? value : 'overview';
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;

  const defaults = defaultPeriod();
  const from = params.from
    ? new Date(`${params.from}T00:00:00`)
    : defaults.from;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : defaults.to;
  const tab = parseTab(params.tab);

  const report = await new GetFinancialReportUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleRecurringTransactionRepository(),
  ).execute(userId, { from, to });

  const periodQueryString = `from=${toDateInputValue(from)}&to=${toDateInputValue(to)}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form
            className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
            method="get"
          >
            <input type="hidden" name="tab" value={tab} />
            <input
              type="date"
              name="from"
              aria-label="De"
              defaultValue={toDateInputValue(from)}
              className={FIELD_BASE_CLASSES}
            />
            <input
              type="date"
              name="to"
              aria-label="Até"
              defaultValue={toDateInputValue(to)}
              className={FIELD_BASE_CLASSES}
            />
            <button
              type="submit"
              className="border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              Filtrar período
            </button>
          </form>
          <ExportButtons periodQueryString={periodQueryString} />
        </div>

        <ReportTabsNav activeTab={tab} periodQueryString={periodQueryString} />

        {tab === 'overview' && (
          <OverviewSection report={report} from={from} to={to} />
        )}
        {tab === 'accounts' && (
          <AccountsSection accountSeries={report.accountSeries} />
        )}
        {tab === 'comparisons' && (
          <ComparisonsSection
            yearOverYear={report.yearOverYear}
            sameMonthLastYear={report.sameMonthLastYear}
            trendStats={report.trendStats}
          />
        )}
      </div>
    </AppShell>
  );
}
```

(`AccountsSection`, `ComparisonsSection`, `ExportButtons` are created in Tasks 19-21, 23 — this step's typecheck will fail until those exist; that's expected and resolved by the next tasks, which is why this task's own verification step only compiles `overview-section.tsx` in isolation. See Step 3.)

- [ ] **Step 3: Typecheck `overview-section.tsx` in isolation**

Run: `pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep overview-section`
Expected: no output (no errors in the new file) — the broader `page.tsx` typecheck is expected to still fail at this point on the not-yet-created imports (`AccountsSection` from Task 19, `ComparisonsSection` from Task 20, `ExportButtons` from Task 23); that resolves once Task 23 lands.

- [ ] **Step 4: Commit**

```bash
git add src/app/reports/overview-section.tsx src/app/reports/page.tsx
git commit -m "refactor(reports): split page.tsx into a thin shell + overview-section, wire in charts"
```

---

### Task 19: `AccountsSection` ("Por conta" tab)

**Files:**

- Create: `src/components/reports/account-balance-chart.tsx`
- Create: `src/app/reports/accounts-section.tsx`

**Interfaces:**

- Consumes: `AccountSeries[]` (Task 10).
- Produces: `<AccountsSection accountSeries={AccountSeries[]} />` — consumed by `page.tsx` (Task 18).

- [ ] **Step 1: Write the multi-line chart**

Multiple accounts are "tell distinct series apart" (dataviz form table) → categorical multi-line, one color per account from the same 6-slot palette, folding past the 6th account into an "Outros" aggregate line. Recharts wants one row per month with one key per account, so this component pivots `AccountSeries[]` (one array per account) into that shape.

```tsx
'use client';

import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import type { AccountSeries } from '@/modules/reports/application/metrics/calculate-account-series';
import {
  CHART_CATEGORICAL_COLORS,
  CHART_GRID_COLOR,
  CHART_OTHER_COLOR,
  CHART_OTHER_LABEL,
} from '@/shared/constants/chart-colors';
import { formatMonthLabel } from '@/shared/lib/format-date';
import { splitPastLimit } from '@/shared/lib/split-past-limit';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';

interface AccountBalanceChartProps {
  accountSeries: AccountSeries[];
}

const MAX_LINES = CHART_CATEGORICAL_COLORS.length;

export function AccountBalanceChart({
  accountSeries,
}: AccountBalanceChartProps) {
  const { head: shown, tail: folded } = splitPastLimit(
    accountSeries,
    MAX_LINES,
  );

  const months = shown[0]?.balanceByMonth.map((p) => p.month) ?? [];
  const data = months.map((month, i) => {
    const row: Record<string, string | number> = {
      month: formatMonthLabel(month),
    };
    for (const series of shown) {
      row[series.accountName] = series.balanceByMonth[i]?.netWorth ?? 0;
    }
    if (folded.length > 0) {
      row[CHART_OTHER_LABEL] = folded.reduce(
        (sum, series) => sum + (series.balanceByMonth[i]?.netWorth ?? 0),
        0,
      );
    }
    return row;
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid
            stroke={CHART_GRID_COLOR}
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {shown.map((series, i) => (
            <Line
              key={series.accountId}
              type="monotone"
              dataKey={series.accountName}
              stroke={CHART_CATEGORICAL_COLORS[i]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
          {folded.length > 0 && (
            <Line
              type="monotone"
              dataKey={CHART_OTHER_LABEL}
              stroke={CHART_OTHER_COLOR}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write the section (chart + table view)**

The dataviz skill requires a table view alongside every chart, not only the visual — and `AccountSeries[]`'s natural shape already gives us one for free.

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { AccountBalanceChart } from '@/components/reports/account-balance-chart';
import type { AccountSeries } from '@/modules/reports/application/metrics/calculate-account-series';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatMonthLabel } from '@/shared/lib/format-date';

interface AccountsSectionProps {
  accountSeries: AccountSeries[];
}

export function AccountsSection({ accountSeries }: AccountsSectionProps) {
  if (accountSeries.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Nenhuma conta visível."
          description="Crie uma conta para acompanhar sua evolução ao longo do tempo."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Saldo por conta</CardTitle>
          <CardDescription>
            Evolução mensal do saldo de cada conta visível.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6 p-0">
          <AccountBalanceChart accountSeries={accountSeries} />
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Tabela de saldos</CardTitle>
          <CardDescription>
            Mesmos dados do gráfico acima, em formato de tabela.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left">
                <th className="py-2 pr-4">Conta</th>
                {accountSeries[0]?.balanceByMonth.map((point) => (
                  <th
                    key={point.month.toISOString()}
                    className="py-2 pr-4 text-right capitalize"
                  >
                    {formatMonthLabel(point.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountSeries.map((series) => (
                <tr
                  key={series.accountId}
                  className="border-border border-b last:border-0"
                >
                  <td className="py-2 pr-4 font-medium">
                    {series.accountName}
                  </td>
                  {series.balanceByMonth.map((point) => (
                    <td
                      key={point.month.toISOString()}
                      className="dimension-figure py-2 pr-4 text-right"
                    >
                      {formatCurrency(point.netWorth)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (now that `AccountsSection` exists, `page.tsx`'s import of it resolves — `ComparisonsSection`/`ExportButtons` are still pending, from Tasks 20/23).

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/account-balance-chart.tsx src/app/reports/accounts-section.tsx
git commit -m "feat(reports): add AccountsSection with per-account balance chart and table"
```

---

### Task 20: `ComparisonsSection` ("Comparações" tab)

YoY, same-month-last-year, and trend stats are headline numbers with a delta, not a chart — per the dataviz skill's "Is it even a chart?" table, a handful of headline numbers is a **KPI row of stat tiles**, not a bar/pie chart. This task adds a small reusable `StatTile` and composes it.

**Files:**

- Create: `src/components/ui/stat-tile.tsx`
- Create: `src/app/reports/comparisons-section.tsx`

**Interfaces:**

- Consumes: `PeriodComparison` (Task 9), `CategoryTrendStats[]` (Task 11).
- Produces: `<ComparisonsSection yearOverYear sameMonthLastYear trendStats />` — consumed by `page.tsx` (Task 18).

- [ ] **Step 1: Write the `StatTile` component**

Per the dataviz skill's stat-tile contract: label (sentence case, no trailing colon), value (sans semibold), delta (signed, colored by direction × whether up is good).

```tsx
interface StatTileProps {
  label: string;
  value: string;
  deltaPercent: number | null;
  /** Whether a positive delta is good news (income) or bad news (expense). */
  upIsGood: boolean;
}

export function StatTile({
  label,
  value,
  deltaPercent,
  upIsGood,
}: StatTileProps) {
  const isUp = deltaPercent !== null && deltaPercent > 0;
  const isGoodDirection = isUp === upIsGood;

  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="dimension-figure mt-1 text-2xl font-semibold">{value}</p>
      {deltaPercent !== null ? (
        <p
          className={`mt-1 text-sm ${isGoodDirection ? 'text-success' : 'text-destructive'}`}
        >
          {isUp ? '+' : ''}
          {deltaPercent.toFixed(1)}%
        </p>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm">Sem dado anterior</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the section**

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import type { PeriodComparison } from '@/modules/reports/application/metrics/calculate-period-comparison';
import type { CategoryTrendStats } from '@/modules/reports/application/metrics/calculate-trend-stats';
import { formatCurrency } from '@/shared/lib/format-currency';

interface ComparisonsSectionProps {
  yearOverYear: PeriodComparison;
  sameMonthLastYear: PeriodComparison;
  trendStats: CategoryTrendStats[];
}

const TREND_LABELS: Record<CategoryTrendStats['trend'], string> = {
  subindo: 'Subindo',
  caindo: 'Caindo',
  estável: 'Estável',
  insuficiente: 'Dado insuficiente',
};

export function ComparisonsSection({
  yearOverYear,
  sameMonthLastYear,
  trendStats,
}: ComparisonsSectionProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Ano a ano</CardTitle>
          <CardDescription>
            1º de janeiro até hoje, comparado ao mesmo intervalo no ano
            anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          <StatTile
            label="Receitas"
            value={formatCurrency(yearOverYear.income.currentTotal)}
            deltaPercent={yearOverYear.income.deltaPercent}
            upIsGood
          />
          <StatTile
            label="Despesas"
            value={formatCurrency(yearOverYear.expense.currentTotal)}
            deltaPercent={yearOverYear.expense.deltaPercent}
            upIsGood={false}
          />
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Mesmo mês, ano passado</CardTitle>
          <CardDescription>
            O mês atual comparado ao mesmo mês do ano anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          <StatTile
            label="Receitas"
            value={formatCurrency(sameMonthLastYear.income.currentTotal)}
            deltaPercent={sameMonthLastYear.income.deltaPercent}
            upIsGood
          />
          <StatTile
            label="Despesas"
            value={formatCurrency(sameMonthLastYear.expense.currentTotal)}
            deltaPercent={sameMonthLastYear.expense.deltaPercent}
            upIsGood={false}
          />
        </CardContent>
      </Card>

      <Card className="overflow-x-auto p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Tendência por categoria</CardTitle>
          <CardDescription>
            Média, mediana e direção da despesa mensal no período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 p-0">
          {trendStats.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sem dados suficientes no período selecionado.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left">
                  <th className="py-2 pr-4">Categoria</th>
                  <th className="py-2 pr-4 text-right">Média mensal</th>
                  <th className="py-2 pr-4 text-right">Mediana mensal</th>
                  <th className="py-2 text-right">Tendência</th>
                </tr>
              </thead>
              <tbody>
                {trendStats.map((stat) => (
                  <tr
                    key={stat.categoryId}
                    className="border-border border-b last:border-0"
                  >
                    <td className="py-2 pr-4 font-medium">
                      {stat.categoryName}
                    </td>
                    <td className="dimension-figure py-2 pr-4 text-right">
                      {formatCurrency(stat.average)}
                    </td>
                    <td className="dimension-figure py-2 pr-4 text-right">
                      {formatCurrency(stat.median)}
                    </td>
                    <td className="py-2 text-right">
                      {TREND_LABELS[stat.trend]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (now only `ExportButtons`, Task 23, remains before `page.tsx` fully compiles).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/stat-tile.tsx src/app/reports/comparisons-section.tsx
git commit -m "feat(reports): add ComparisonsSection with YoY/same-month stat tiles and trend table"
```

---

## Group E — Export (CSV + PDF)

### Task 21: `buildReportCsvRows` (pure function, unit tested)

Following the same convention as `/api/transactions/export/route.ts` (which has zero tests of its own — only the logic beneath a route is unit tested in this project), the route handler in Task 23 stays thin and untested; the row-shaping logic that actually matters for correctness is extracted here and tested directly.

**Files:**

- Create: `src/modules/reports/application/build-report-csv-rows.ts`
- Test: `src/modules/reports/application/build-report-csv-rows.test.ts`

**Interfaces:**

- Consumes: `FinancialReport` (Task 12).
- Produces: `buildReportCsvRows(report: FinancialReport): string[][]` — consumed by Task 23.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import type { FinancialReport } from './get-financial-report.use-case';
import { buildReportCsvRows } from './build-report-csv-rows';

function emptyReport(
  overrides: Partial<FinancialReport> = {},
): FinancialReport {
  return {
    totalIncome: 0,
    totalExpense: 0,
    cashFlowByMonth: [],
    spendingByCategory: [],
    netWorthByMonth: [],
    budgetsOverview: [],
    categoryComparison: [],
    recurringExpenseShare: {
      monthlyRecurringExpense: 0,
      averageMonthlyIncome: 0,
      percentage: null,
    },
    accountSeries: [],
    yearOverYear: {
      income: { currentTotal: 0, previousTotal: 0, deltaPercent: null },
      expense: { currentTotal: 0, previousTotal: 0, deltaPercent: null },
      byCategory: [],
    },
    sameMonthLastYear: {
      income: { currentTotal: 0, previousTotal: 0, deltaPercent: null },
      expense: { currentTotal: 0, previousTotal: 0, deltaPercent: null },
      byCategory: [],
    },
    trendStats: [],
    ...overrides,
  };
}

describe('buildReportCsvRows', () => {
  it('includes a header row and one row per category spending entry', () => {
    const report = emptyReport({
      spendingByCategory: [
        { categoryId: 'cat-1', categoryName: 'Alimentação', total: 150.5 },
      ],
    });
    const rows = buildReportCsvRows(report);
    expect(rows[0]).toEqual(['Categoria', 'Total no período']);
    expect(rows[1]).toEqual(['Alimentação', '150.50']);
  });

  it('renders a valid header-only table when there is no spending', () => {
    const rows = buildReportCsvRows(emptyReport());
    expect(rows).toEqual([['Categoria', 'Total no período']]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/modules/reports/application/build-report-csv-rows.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { FinancialReport } from './get-financial-report.use-case';

const HEADER = ['Categoria', 'Total no período'];

export function buildReportCsvRows(report: FinancialReport): string[][] {
  const rows = report.spendingByCategory.map((category) => [
    category.categoryName,
    category.total.toFixed(2),
  ]);
  return [HEADER, ...rows];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/modules/reports/application/build-report-csv-rows.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/reports/application/build-report-csv-rows.ts src/modules/reports/application/build-report-csv-rows.test.ts
git commit -m "feat(reports): add buildReportCsvRows for CSV export"
```

---

### Task 22: `@react-pdf/renderer` dependency + `ReportPdfDocument`

Visual, not unit tested — same convention as the chart components (Group C). Keeps the same restrained look (plain sans, no color beyond the brand primary for headings) rather than @react-pdf/renderer's default styling.

**Files:**

- Modify: `package.json` (add `@react-pdf/renderer: ^4.9.0`)
- Create: `src/modules/reports/infra/report-pdf-document.tsx`

- [ ] **Step 1: Add the dependency**

```bash
pnpm add @react-pdf/renderer@^4.9.0
```

- [ ] **Step 2: Write the PDF document component**

```tsx
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 4, color: '#1d4e89' },
  subtitle: { fontSize: 10, marginBottom: 16, color: '#5a7185' },
  sectionTitle: {
    fontSize: 12,
    marginTop: 16,
    marginBottom: 6,
    color: '#1d4e89',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  label: { color: '#12233d' },
  value: { fontFamily: 'Helvetica-Bold' },
});

interface ReportPdfDocumentProps {
  report: FinancialReport;
  period: { from: Date; to: Date };
}

export function ReportPdfDocument({ report, period }: ReportPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório financeiro — Hermes</Text>
        <Text style={styles.subtitle}>
          {formatDate(period.from)} — {formatDate(period.to)}
        </Text>

        <Text style={styles.sectionTitle}>Totais do período</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Receitas</Text>
          <Text style={styles.value}>{formatCurrency(report.totalIncome)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Despesas</Text>
          <Text style={styles.value}>
            {formatCurrency(report.totalExpense)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Gastos por categoria</Text>
        {report.spendingByCategory.length === 0 ? (
          <Text style={styles.label}>
            Nenhuma despesa registrada neste período.
          </Text>
        ) : (
          report.spendingByCategory.map((category) => (
            <View key={category.categoryId} style={styles.row}>
              <Text style={styles.label}>{category.categoryName}</Text>
              <Text style={styles.value}>{formatCurrency(category.total)}</Text>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/reports/infra/report-pdf-document.tsx package.json pnpm-lock.yaml
git commit -m "feat(reports): add @react-pdf/renderer and ReportPdfDocument"
```

---

### Task 23: `/api/reports/export/route.ts` + `ExportButtons`

**Files:**

- Create: `src/app/api/reports/export/route.ts`
- Test: `src/app/api/reports/export/route.test.ts` (401 guard only — the one route test in this plan, see Global Constraints)
- Create: `src/app/reports/export-buttons.tsx`

**Interfaces:**

- Consumes: `GetFinancialReportUseCase` (Task 12), `buildReportCsvRows` (Task 21), `ReportPdfDocument` (Task 22), `defaultPeriod` (Task 17).
- Produces: `GET /api/reports/export?format=csv|pdf&from=...&to=...`, `<ExportButtons periodQueryString={string} />` — consumed by `page.tsx` (Task 18, already imports it).

- [ ] **Step 1: Write the failing 401-guard test**

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/infra/auth/session', () => ({
  requireCurrentUserId: vi.fn().mockRejectedValue(new Error('redirect')),
}));

describe('GET /api/reports/export', () => {
  it('returns 401 without touching any repository when the caller is not authenticated', async () => {
    const { GET } = await import('./route');
    const request = new Request(
      'http://localhost/api/reports/export?format=csv',
    ) as never;

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/api/reports/export/route.test.ts`
Expected: FAIL — `./route` does not exist yet.

- [ ] **Step 3: Write the route handler**

```ts
import { renderToStream } from '@react-pdf/renderer';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';

import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { buildReportCsvRows } from '@/modules/reports/application/build-report-csv-rows';
import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';
import { defaultPeriod } from '@/modules/reports/default-period';
import { ReportPdfDocument } from '@/modules/reports/infra/report-pdf-document';
import { buildCsv } from '@/shared/lib/csv';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return new Response('Não autenticado.', { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const format = params.get('format') === 'pdf' ? 'pdf' : 'csv';
  const defaults = defaultPeriod();
  const fromParam = params.get('from');
  const toParam = params.get('to');
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaults.from;
  const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaults.to;

  const report = await new GetFinancialReportUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleRecurringTransactionRepository(),
  ).execute(userId, { from, to });

  if (format === 'pdf') {
    // Calling the component as a plain function (not JSX) deliberately avoids needing a
    // .tsx extension for this route file — ReportPdfDocument has no hooks, so invoking it
    // directly just runs its body and returns the <Document> element renderToStream wants.
    const nodeStream = await renderToStream(
      ReportPdfDocument({ report, period: { from, to } }),
    );
    return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="relatorio.pdf"',
      },
    });
  }

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + buildCsv(buildReportCsvRows(report));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio.csv"',
    },
  });
}
```

- [ ] **Step 4: Run the 401-guard test to verify it passes**

Run: `pnpm vitest run src/app/api/reports/export/route.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write the export buttons**

```tsx
interface ExportButtonsProps {
  periodQueryString: string;
}

export function ExportButtons({ periodQueryString }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <a
        href={`/api/reports/export?${periodQueryString}&format=csv`}
        className="border-input bg-background hover:bg-accent rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
      >
        Exportar CSV
      </a>
      <a
        href={`/api/reports/export?${periodQueryString}&format=pdf`}
        className="border-input bg-background hover:bg-accent rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
      >
        Exportar PDF
      </a>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck the whole project**

Run: `pnpm typecheck`
Expected: PASS — `page.tsx`'s imports of `AccountsSection`, `ComparisonsSection`, and `ExportButtons` all resolve now.

- [ ] **Step 7: Run the full test suite**

Run: `pnpm vitest run`
Expected: PASS — every test from every prior task, plus the pre-existing suite, green.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/reports/export/route.ts src/app/api/reports/export/route.test.ts src/app/reports/export-buttons.tsx
git commit -m "feat(reports): add CSV/PDF export route (with 401 guard test) and export buttons"
```

---

### Task 24: Manual smoke test

No automated test covers the page itself (Global Constraints) — this task is a manual pass through the running app before calling the feature done.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

- [ ] **Step 2: Walk through `/reports`**

- Load `/reports` with no query params — Visão Geral renders with the three new charts (net worth bars colored by sign, income/expense grouped bars, category donut + legend), no console errors.
- Click "Por conta" — multi-line chart + table render, hidden accounts absent.
- Click "Comparações" — YoY and same-month stat tiles show a value and either a colored delta or "Sem dado anterior"; trend table shows average/median/trend per category.
- Click "Exportar CSV" — a `relatorio.csv` downloads and opens with correct headers/accented characters in a spreadsheet app.
- Click "Exportar PDF" — a `relatorio.pdf` downloads and opens, showing totals and category breakdown.
- Toggle the OS/app color theme — all three chart types stay legible in dark mode (categorical slice colors, status colors, grid lines).

- [ ] **Step 3: Report results to the user**

Summarize what was checked and any visual issues found, before considering the plan complete.

---
