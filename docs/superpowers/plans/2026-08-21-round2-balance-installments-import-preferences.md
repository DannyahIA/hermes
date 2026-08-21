# Rodada 2 — Saldo atual, parcelamento flexível, importação com preview, preferências de visualização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task, with ONE MODIFICATION explicitly requested by the user: **do not run a task-scoped review after each task.** Dispatch implementers sequentially (never in parallel — several tasks share files), record each completion in the ledger, and move straight to the next task. Run exactly ONE consolidated review of all 14 tasks together at the very end (same shape as Round 1's final whole-branch review: most capable model, full diff, then the standard one-fix-wave-plus-one-scoped-re-review pattern for whatever it finds). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show users their true current balance (not inflated by future installments), let installment purchases be entered by either total or per-installment amount, add a preview-before-confirm step with duplicate detection to CSV import, and let users persist how they want `/transactions` grouped.

**Architecture:** All four features are additive — no existing use-case's stored-data behavior changes. Current balance is a new derived read (`computeCurrentBalance`) layered on top of the existing stored `balance` column. Flexible installment input is a schema/use-case extension (accepts one of two optional fields, computes the other). Import preview is a new two-action flow (`previewImportAction` → client-rendered table → `confirmImportAction`) reusing the existing CSV/matching logic, with no server-side temp storage. View preferences are a new small, deliberately generic table + repository + two tiny use-cases.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Drizzle ORM + PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-round2-balance-installments-import-preferences-design.md`

## Global Constraints

- TypeScript strict mode, no `any`. Follow the existing `app → modules → core` / `infra` layering — contracts in `core/contracts`, Drizzle implementations in `infra/repositories`.
- No transaction/installment materialization behavior changes — `CreateInstallmentPlanUseCase` still applies every installment's delta immediately; only how its `totalAmount` is computed changes (§2 of the spec).
- Transfer legs' future-balance reversal uses the same `+amount` convention already in `DeleteTransactionUseCase` — a known, pre-existing, out-of-scope limitation (spec §1), not something this plan fixes.
- Server Actions follow the existing 3-step shape: validate via Zod → run use-case → return `ActionResult` (reuse the type from `src/app/transactions/actions.ts` where applicable).
- Imports must pass `simple-import-sort/imports` (`npx eslint --fix`).
- Currency via `formatCurrency`, dates via `formatDate` — never reimplement.
- No new runtime dependency in this plan.
- Client Components only ever receive plain serializable objects (no entity class instances, no `Map`) — Round 1 found a real production bug from this exact mistake; every task that passes data from a Server Component page into a `'use client'` component must map entities to plain `{...}` objects first.
- Tasks in this plan are NOT individually reviewed — see the header note above. Each task must still be genuinely complete, tested, and self-verified (`npx tsc --noEmit`, `npx eslint src --max-warnings=0`, `npx vitest run` all clean) before moving to the next, since there is no safety net until the single final review.

---

## File Structure

**New files:**

- `src/core/value-objects/current-balance.ts` — `computeCurrentBalance()`.
- `src/core/value-objects/current-balance.test.ts`.
- `src/modules/accounts/application/get-accounts.use-case.test.ts` (first test for this use-case).
- `src/modules/installments/application/create-installment-plan.use-case.test.ts` — extended (existing test file, add flexible-amount cases).
- `src/app/transactions/import-preview-table.tsx` — client component rendering the preview.
- `src/infra/database/migrations/000X_*.sql` — generated for `user_view_preferences`.
- `src/core/contracts/view-preference-repository.ts`.
- `src/core/entities/view-preference.ts`.
- `src/infra/repositories/drizzle-view-preference.repository.ts`.
- `src/tests/fakes/fake-view-preference.repository.ts`.
- `src/modules/preferences/application/get-view-preference.use-case.ts` + `.test.ts`.
- `src/modules/preferences/application/set-view-preference.use-case.ts` + `.test.ts`.
- `src/app/transactions/view-mode-selector.tsx` — client component, small.
- `src/app/transactions/preferences-actions.ts` — `setViewPreferenceAction`.
- `src/shared/lib/group-transactions-by-category.ts` + `.test.ts`, `src/shared/lib/group-transactions-by-month.ts` + `.test.ts` — the two new grouping modes (the existing `group-transactions-by-period.ts` from Round 1 already covers the chronological/temporal mode).

**Modified files:**

- `src/modules/accounts/application/get-accounts.use-case.ts` — returns `AccountWithBalances[]`.
- `src/modules/dashboard/application/get-dashboard-summary.use-case.ts` — `netWorth` from current balances; per-account balances added to `DashboardSummary`.
- `src/app/dashboard/page.tsx` — saldo atual/projetado blocks.
- `src/app/accounts/page.tsx`, `src/app/accounts/account-card.tsx` — current/projected display.
- `src/modules/installments/schemas/create-installment-plan.schema.ts` — flexible amount.
- `src/modules/installments/application/create-installment-plan.use-case.ts` — computes missing amount.
- `src/app/transactions/actions.ts` — `createInstallmentAction` passes the new field; adds `previewImportAction`/`confirmImportAction`.
- `src/app/transactions/transaction-form.tsx` — amount-mode toggle.
- `src/app/transactions/import-dialog.tsx` — two-step flow.
- `src/infra/database/schema.ts` — `userViewPreferences` table.
- `src/app/transactions/page.tsx` — reads the view preference, renders the selected grouping.
- `src/app/transactions/transaction-list.tsx` — accepts a `groupBy` prop, uses the right grouping function.

---

### Task 1: `computeCurrentBalance` value object + tests

**Files:**

- Create: `src/core/value-objects/current-balance.ts`
- Create: `src/core/value-objects/current-balance.test.ts`

**Interfaces:**

- Produces: `computeCurrentBalance(storedBalance: number, futureTransactions: Array<{ type: 'income' | 'expense' | 'transfer'; amount: number }>, account: { deltaFor(type: 'income' | 'expense', amount: number): number }): number`. Consumed by Tasks 2 and 3.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';

function makeAccount(type: 'checking' | 'savings' | 'credit' = 'checking') {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Conta',
    type,
    balance: 0,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('computeCurrentBalance', () => {
  it('returns the stored balance unchanged when there are no future transactions', () => {
    const result = computeCurrentBalance(1000, [], makeAccount());
    expect(result).toBe(1000);
  });

  it('subtracts a future expense (checking account) from the stored balance', () => {
    // storedBalance already had the future expense's delta (-165) applied,
    // so reversing it means adding 165 back.
    const result = computeCurrentBalance(
      835,
      [{ type: 'expense', amount: 165 }],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });

  it('subtracts a future income from the stored balance', () => {
    const result = computeCurrentBalance(
      1200,
      [{ type: 'income', amount: 200 }],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });

  it('inverts the sign for a credit account (expense increases stored debt balance)', () => {
    // A future expense on a credit card increases the stored balance
    // (debt) — reversing it means subtracting.
    const result = computeCurrentBalance(
      1165,
      [{ type: 'expense', amount: 165 }],
      makeAccount('credit'),
    );
    expect(result).toBe(1000);
  });

  it('sums the effect of multiple future transactions', () => {
    const result = computeCurrentBalance(
      1000 - 165 - 165 + 50,
      [
        { type: 'expense', amount: 165 },
        { type: 'expense', amount: 165 },
        { type: 'income', amount: 50 },
      ],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });

  it('reverses a future transfer leg by subtracting its amount unconditionally', () => {
    // Matches DeleteTransactionUseCase's existing (pre-Round-2) convention —
    // see the spec's "Limitação conhecida".
    const result = computeCurrentBalance(
      1000 + 300,
      [{ type: 'transfer', amount: 300 }],
      makeAccount(),
    );
    expect(result).toBe(1000);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/core/value-objects/current-balance.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import type { Account } from '@/core/entities/account';

export interface FutureTransactionEffect {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
}

/**
 * Hermes materializes every installment of a purchase/loan as a real,
 * future-dated `Transaction` at creation time (see
 * `CreateInstallmentPlanUseCase`), applying its balance delta immediately.
 * That means the stored `account.balance` already reflects every known
 * future commitment — it is, in effect, the *projected* balance, not the
 * balance "right now". This function derives the true current balance by
 * reversing the effect of every transaction dated after today.
 *
 * Transfer legs are reversed by unconditionally subtracting `amount` —
 * matching `DeleteTransactionUseCase`'s existing convention, since a
 * transfer transaction row doesn't record which leg (debit/credit) it is.
 * This is a known, pre-existing limitation this function does not attempt
 * to fix (see the spec's "Limitação conhecida").
 */
export function computeCurrentBalance(
  storedBalance: number,
  futureTransactions: FutureTransactionEffect[],
  account: Pick<Account, 'deltaFor'>,
): number {
  const futureEffect = futureTransactions.reduce((sum, transaction) => {
    const delta =
      transaction.type === 'transfer'
        ? transaction.amount
        : account.deltaFor(transaction.type, transaction.amount);
    return sum + delta;
  }, 0);

  return storedBalance - futureEffect;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/core/value-objects/current-balance.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/value-objects/current-balance.ts src/core/value-objects/current-balance.test.ts
git commit -m "feat: add computeCurrentBalance deriving current balance from stored balance minus future transactions"
```

---

### Task 2: `GetAccountsUseCase` returns current + projected balances

**Files:**

- Modify: `src/modules/accounts/application/get-accounts.use-case.ts`
- Create: `src/modules/accounts/application/get-accounts.use-case.test.ts`

**Interfaces:**

- Consumes: `computeCurrentBalance` (Task 1), `TransactionRepository.findByUserId` (existing, `from` filter already supported).
- Produces: `AccountWithBalances { account: Account; currentBalance: number; projectedBalance: number }`, `GetAccountsUseCase.execute(userId): Promise<AccountWithBalances[]>`. Consumed by Task 4 (accounts page) and Task 3 doesn't consume this directly (dashboard has its own aggregation) but must use an identical `AccountWithBalances` shape for consistency — copy the interface verbatim in Task 3, don't reinvent it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { Account } from '@/core/entities/account';
import { Transaction } from '@/core/entities/transaction';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';
import { FakeAccountRepository } from '@/tests/fakes/fake-account.repository';
import { FakeTransactionRepository } from '@/tests/fakes/fake-transaction.repository';

describe('GetAccountsUseCase', () => {
  it('returns each account with its stored balance as projected, and current balance excluding future transactions', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();

    const account = new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta corrente',
      type: 'checking',
      balance: 835, // already includes a future -165 expense
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await accountRepository.save(account);

    const future = new Transaction({
      id: 'tx-future',
      accountId: 'acc-1',
      description: 'Parcela futura',
      amount: 165,
      type: 'expense',
      occurredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await transactionRepository.save(future);

    const result = await new GetAccountsUseCase(
      accountRepository,
      transactionRepository,
    ).execute('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].projectedBalance).toBe(835);
    expect(result[0].currentBalance).toBe(1000);
  });

  it('current equals projected when there are no future transactions', async () => {
    const accountRepository = new FakeAccountRepository();
    const transactionRepository = new FakeTransactionRepository();

    await accountRepository.save(
      new Account({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Conta',
        type: 'checking',
        balance: 500,
        currency: 'BRL',
        archived: false,
        hidden: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const result = await new GetAccountsUseCase(
      accountRepository,
      transactionRepository,
    ).execute('user-1');

    expect(result[0].currentBalance).toBe(500);
    expect(result[0].projectedBalance).toBe(500);
  });
});
```

Check `src/tests/fakes/fake-account.repository.ts` and `src/tests/fakes/fake-transaction.repository.ts` for their real constructor/method signatures before finalizing this step — adjust the fake usage to match if it differs from the above (both should already support `save`/`findByUserId` per Round 1's established patterns).

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/modules/accounts/application/get-accounts.use-case.test.ts`
Expected: FAIL (`GetAccountsUseCase` constructor doesn't accept a second argument yet, or the returned shape doesn't have `.currentBalance`/`.projectedBalance`).

- [ ] **Step 3: Implement**

```ts
import type { AccountRepository } from '@/core/contracts/account-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';

export interface AccountWithBalances {
  account: Account;
  currentBalance: number;
  projectedBalance: number;
}

function startOfTomorrow(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * Returns every account the user owns, each paired with its current
 * balance (excludes not-yet-occurred transactions, e.g. future installments)
 * and its projected balance (the stored balance as-is — see
 * `computeCurrentBalance`'s doc comment for why the stored value already
 * *is* the projection).
 */
export class GetAccountsUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(userId: string): Promise<AccountWithBalances[]> {
    const accounts = await this.accountRepository.findByUserId(userId);

    const futureTransactions = await this.transactionRepository.findByUserId(
      userId,
      {
        from: startOfTomorrow(),
        pageSize: 10_000,
      },
    );
    const futureByAccountId = new Map<string, typeof futureTransactions>();
    for (const transaction of futureTransactions) {
      const list = futureByAccountId.get(transaction.accountId) ?? [];
      list.push(transaction);
      futureByAccountId.set(transaction.accountId, list);
    }

    return accounts.map((account) => {
      const future = futureByAccountId.get(account.id) ?? [];
      return {
        account,
        projectedBalance: account.balance,
        currentBalance: computeCurrentBalance(account.balance, future, account),
      };
    });
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/modules/accounts/application/get-accounts.use-case.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Update every existing caller of `GetAccountsUseCase`**

`GetAccountsUseCase.execute()` now returns `AccountWithBalances[]` instead of `Account[]` — this is a breaking interface change. Search for every call site:

Run: `grep -rln "GetAccountsUseCase" src --include=*.tsx --include=*.ts`

For each caller found (this plan expects `src/app/accounts/page.tsx`, `src/app/transactions/page.tsx`, `src/app/transactions/recurring-transaction-form-dialog.tsx`'s data-fetching caller if any, and possibly others), update the call to also pass a `TransactionRepository` instance (e.g. `new DrizzleTransactionRepository()`), and update every downstream usage of the result from `accounts[i].someProp` to `accounts[i].account.someProp` (or destructure `{ account, currentBalance, projectedBalance }`). Do this NOW as part of this task, not later — leaving other pages broken until a future task is exactly the kind of gap this plan's single-final-review approach can't safely catch mid-stream, so each task must leave the whole project green. **`src/app/accounts/page.tsx` and `src/app/dashboard/page.tsx`'s real balance-display wiring is still Tasks 3/4/5's job — for this step, only make every call site typecheck and behave identically to before (e.g. reference `.account.balance` wherever the old code said `.balance`) so the build is green; do not add the new current/projected UI yet, that's later tasks' scope.**

- [ ] **Step 6: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: all clean, no regressions in the existing suite.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: GetAccountsUseCase returns current and projected balance per account"
```

---

### Task 3: `GetDashboardSummaryUseCase` uses current balance for `netWorth`

**Files:**

- Modify: `src/modules/dashboard/application/get-dashboard-summary.use-case.ts`
- Modify: `src/modules/dashboard/application/get-dashboard-summary.use-case.test.ts` if it exists (check first — `grep -rln "get-dashboard-summary" src`); if none exists, create it.

**Interfaces:**

- Consumes: `computeCurrentBalance` (Task 1).
- Produces: `DashboardSummary` gains `accountBalances: Array<{ account: Account; currentBalance: number; projectedBalance: number }>` (same shape as Task 2's `AccountWithBalances` — reuse that exported type, do not redefine it). `netWorth` is now the sum of `currentBalance` across non-hidden accounts (previously summed `account.balance` directly).

- [ ] **Step 1: Check for an existing test file and read the current use-case in full**

Run: `grep -rln "GetDashboardSummaryUseCase" src --include=*.test.ts`. If a test file exists, read it fully before modifying — you'll extend it, not replace it. Read `src/modules/dashboard/application/get-dashboard-summary.use-case.ts` in full (already partially quoted in this plan's earlier investigation, but re-read live since other tasks may have touched shared files).

- [ ] **Step 2: Write the failing test(s)**

Add to the existing test file (or create `src/modules/dashboard/application/get-dashboard-summary.use-case.test.ts` if none exists) a case verifying `netWorth` excludes future installment effects:

```ts
it('computes netWorth from current balances, excluding future installment effects', async () => {
  const accountRepository = new FakeAccountRepository();
  const transactionRepository = new FakeTransactionRepository();
  const budgetRepository = new FakeBudgetRepository();

  await accountRepository.save(
    new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta',
      type: 'checking',
      balance: 835, // stored balance already has a future -165 installment applied
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  await transactionRepository.save(
    new Transaction({
      id: 'tx-future',
      accountId: 'acc-1',
      description: 'Parcela futura',
      amount: 165,
      type: 'expense',
      occurredAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );

  const summary = await new GetDashboardSummaryUseCase(
    accountRepository,
    transactionRepository,
    budgetRepository,
  ).execute('user-1');

  expect(summary.netWorth).toBe(1000);
  expect(summary.accountBalances).toHaveLength(1);
  expect(summary.accountBalances[0].projectedBalance).toBe(835);
});
```

Import `Account`, `Transaction`, `FakeAccountRepository`, `FakeTransactionRepository`, `FakeBudgetRepository`, `GetDashboardSummaryUseCase` at the top, matching whatever import style the existing test file (if any) already uses; if creating the file fresh, mirror Task 2's test file's import style.

- [ ] **Step 3: Run to confirm failure**

Run: `npx vitest run src/modules/dashboard/application/get-dashboard-summary.use-case.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement**

Modify `src/modules/dashboard/application/get-dashboard-summary.use-case.ts`:

```ts
import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { Transaction } from '@/core/entities/transaction';
import type { AccountWithBalances } from '@/modules/accounts/application/get-accounts.use-case';
import {
  type BudgetProgress,
  GetBudgetProgressUseCase,
} from '@/modules/budgets/application/get-budget-progress.use-case';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';
import {
  buildMonthlyCashFlow,
  type MonthlyCashFlow,
} from '@/shared/lib/build-monthly-cash-flow';

export type { MonthlyCashFlow };

export interface DashboardSummary {
  netWorth: number;
  accounts: Account[];
  accountBalances: AccountWithBalances[];
  /** Every not-yet-occurred transaction across all accounts — already
   * fetched to compute `accountBalances`, exposed here too so the UI can
   * list upcoming commitments (e.g. remaining installments) without a
   * second query. */
  futureTransactions: Transaction[];
  monthIncome: number;
  monthExpense: number;
  recentTransactions: Transaction[];
  cashFlow: MonthlyCashFlow[];
  budgets: BudgetProgress[];
}

const CASH_FLOW_MONTHS = 6;

function startOfTomorrow(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

export class GetDashboardSummaryUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
  ) {}

  async execute(userId: string): Promise<DashboardSummary> {
    const now = new Date();
    const rangeStart = new Date(
      now.getFullYear(),
      now.getMonth() - (CASH_FLOW_MONTHS - 1),
      1,
    );
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      accounts,
      transactionsInRange,
      futureTransactions,
      allRecent,
      budgetProgress,
    ] = await Promise.all([
      this.accountRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: rangeStart,
        to: now,
        pageSize: 1000,
      }),
      this.transactionRepository.findByUserId(userId, {
        from: startOfTomorrow(),
        pageSize: 10_000,
      }),
      this.transactionRepository.findByUserId(userId, { pageSize: 5 }),
      new GetBudgetProgressUseCase(
        this.budgetRepository,
        this.transactionRepository,
      ).execute(userId),
    ]);

    const futureByAccountId = new Map<string, typeof futureTransactions>();
    for (const transaction of futureTransactions) {
      const list = futureByAccountId.get(transaction.accountId) ?? [];
      list.push(transaction);
      futureByAccountId.set(transaction.accountId, list);
    }

    const accountBalances: AccountWithBalances[] = accounts.map((account) => {
      const future = futureByAccountId.get(account.id) ?? [];
      return {
        account,
        projectedBalance: account.balance,
        currentBalance: computeCurrentBalance(account.balance, future, account),
      };
    });

    const netWorth = accountBalances
      .filter(({ account }) => !account.hidden)
      .reduce((sum, { currentBalance }) => sum + currentBalance, 0);

    const cashFlow = buildMonthlyCashFlow(rangeStart, now, transactionsInRange);

    const monthTransactions = transactionsInRange.filter(
      (t) => t.occurredAt >= monthStart,
    );
    const monthIncome = sumByType(monthTransactions, 'income');
    const monthExpense = sumByType(monthTransactions, 'expense');

    return {
      netWorth,
      accounts,
      accountBalances,
      futureTransactions,
      monthIncome,
      monthExpense,
      recentTransactions: allRecent,
      cashFlow,
      budgets: budgetProgress,
    };
  }
}

function sumByType(
  transactions: Transaction[],
  type: Transaction['type'],
): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.amount, 0);
}
```

Note the duplicated future-transactions-grouping logic between this file and Task 2's `GetAccountsUseCase` is intentional at this stage — extracting a shared helper is reasonable but not required by the spec; if you want to reduce duplication, you may extract a small shared `groupTransactionsByAccount(transactions): Map<string, Transaction[]>` helper into `src/shared/lib/`, used by both — do this only if it doesn't risk the "no `any`"/typing constraints, and update both call sites consistently if you do.

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npx vitest run src/modules/dashboard/application/get-dashboard-summary.use-case.test.ts`
Expected: PASS (including any pre-existing tests in that file, now updated for the new return shape if they asserted on `netWorth` with a stored-balance value directly — check and adjust any pre-existing assertion that assumed `netWorth === sum of account.balance` to instead account for future transactions, or use fixtures with no future transactions so the two remain numerically equal).

- [ ] **Step 6: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean. Fix any caller of `DashboardSummary` (e.g. `src/app/dashboard/page.tsx`) that breaks due to the new `accountBalances` field — adding a field is additive and shouldn't break existing consumers, but double-check.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: GetDashboardSummaryUseCase computes netWorth from current balances"
```

---

### Task 4: Dashboard UI — saldo atual vs. projetado

**Files:**

- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**

- Consumes: `DashboardSummary.accountBalances` (Task 3).

- [ ] **Step 1: Read the current file in full**

Other tasks in this plan don't touch `dashboard/page.tsx` before this one, but re-read it live to confirm exact current line numbers/structure before editing (Round 1 already changed some of its grid classes).

- [ ] **Step 2: Add the projected-balance block and future-commitments list next to the existing hero**

In the hero `Card` (the one showing `Patrimônio · {date}` and `summary.netWorth`), add directly below the existing `<p className="ledger-figure ...">{formatCurrency(summary.netWorth)}</p>` line:

```tsx
{
  (() => {
    const projectedTotal = summary.accountBalances
      .filter(({ account }) => !account.hidden)
      .reduce((sum, { projectedBalance }) => sum + projectedBalance, 0);
    const difference = projectedTotal - summary.netWorth;

    if (difference <= 0) return null;

    return (
      <p className="text-muted-foreground mt-1 text-sm">
        Projetado (com compromissos futuros):{' '}
        <span className="ledger-figure font-medium">
          {formatCurrency(projectedTotal)}
        </span>
      </p>
    );
  })();
}
```

This shows the secondary "projetado" figure only when it actually differs from the current balance (avoids noise for users with no pending installments/recurrences), matching the spec's stated rule for the accounts page (applied here to the dashboard hero too, for consistency).

- [ ] **Step 3: Add a "Compromissos futuros" list**

Directly below the sub-stats grid (`{subStats.map(...)}`) but still inside the hero `Card`, add a compact list of future commitments grouped by description (installment plans and recurring rules both leave a stable `description` on each generated transaction, e.g. `"Financiamento apartamento (3/15)"` — group by the description with the trailing `" (N/M)"` stripped, to collapse "Financiamento apartamento (3/15)", "(4/15)", etc. into one line). This uses `summary.futureTransactions` (added to `DashboardSummary` in Task 3 — already fetched there for the balance computation, so this is a zero-cost reuse, not a new query):

```tsx
{
  summary.futureTransactions.length > 0 && (
    <div className="border-border mt-4 border-t pt-4">
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Compromissos futuros
      </p>
      <ul className="space-y-1">
        {Object.entries(
          summary.futureTransactions.reduce<Record<string, number>>(
            (groups, t) => {
              const label = t.description.replace(/\s*\(\d+\/\d+\)$/, '');
              groups[label] = (groups[label] ?? 0) + t.amount;
              return groups;
            },
            {},
          ),
        )
          .slice(0, 5)
          .map(([label, total]) => (
            <li key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="ledger-figure">{formatCurrency(total)}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/dashboard/page.tsx src/modules/dashboard/application/get-dashboard-summary.use-case.ts --max-warnings=0`
Expected: clean.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: dashboard shows projected balance and upcoming commitments"
```

---

### Task 5: Accounts page/card — current vs. projected balance

**Files:**

- Modify: `src/app/accounts/page.tsx`
- Modify: `src/app/accounts/account-card.tsx`

**Interfaces:**

- Consumes: `GetAccountsUseCase` returning `AccountWithBalances[]` (Task 2).

- [ ] **Step 1: Read both files in full (live, current state)**

Task 2, Step 5 already made `accounts/page.tsx` typecheck against the new `AccountWithBalances[]` shape (referencing `.account.X` wherever it used to say `.X`) — re-read it now to see exactly how that adaptation was done, and build this task's real UI on top of it rather than re-deriving it.

- [ ] **Step 2: Update the "Patrimônio total" figure to use current balance**

Change the `total` calculation (currently summing `account.balance`) to sum `currentBalance` instead:

```ts
const total = accountsWithBalances
  .filter(({ account }) => !account.hidden && !account.archived)
  .reduce((sum, { currentBalance }) => sum + currentBalance, 0);
```

(Adjust the variable name to match whatever Task 2 Step 5 actually named the array — likely `accountsWithBalances` or similar; use the real name from the file.)

- [ ] **Step 3: Pass both balances into `AccountCard`**

In the `.map()` that renders `<AccountCard>`, change `balance={account.balance}` to pass both:

```tsx
balance={currentBalance}
projectedBalance={projectedBalance !== currentBalance ? projectedBalance : undefined}
```

(destructuring `{ account, currentBalance, projectedBalance }` from each entry in the `.map()` callback).

- [ ] **Step 4: `AccountCard` renders the secondary figure**

Read `src/app/accounts/account-card.tsx` in full. Add a new optional prop `projectedBalance?: number` to its props interface. Below wherever the card currently renders its main balance figure (`formatCurrency(balance)`), add:

```tsx
{
  projectedBalance !== undefined && (
    <p className="text-muted-foreground text-xs">
      Projetado: {formatCurrency(projectedBalance)}
    </p>
  );
}
```

- [ ] **Step 5: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/accounts --max-warnings=0`
Expected: clean.

- [ ] **Step 6: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: accounts page shows current balance with projected balance as a secondary figure"
```

---

### Task 6: Flexible installment amount — schema + use-case

**Files:**

- Modify: `src/modules/installments/schemas/create-installment-plan.schema.ts`
- Modify: `src/modules/installments/application/create-installment-plan.use-case.ts`
- Modify: `src/modules/installments/application/create-installment-plan.use-case.test.ts` (existing file — read it fully first, add cases, don't replace existing ones)

**Interfaces:**

- Produces: `createInstallmentPlanSchema` accepts `totalAmount?: number` OR `installmentAmount?: number` (exactly one). `CreateInstallmentPlanInput.totalAmount` becomes optional, gains `installmentAmount?: number`.

- [ ] **Step 1: Write the failing tests**

Read the existing test file first. Add these cases (adapting import style to match):

```ts
it('computes totalAmount from installmentAmount when only the per-installment value is given', async () => {
  const installmentPlanRepository = new FakeInstallmentPlanRepository();
  const transactionRepository = new FakeTransactionRepository();
  const accountRepository = new FakeAccountRepository();
  const categoryRepository = new FakeCategoryRepository();

  await accountRepository.save(
    new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta',
      type: 'checking',
      balance: 1000,
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );

  const useCase = new CreateInstallmentPlanUseCase(
    installmentPlanRepository,
    transactionRepository,
    accountRepository,
    categoryRepository,
  );

  const plan = await useCase.execute({
    id: 'plan-1',
    userId: 'user-1',
    accountId: 'acc-1',
    description: 'Compra parcelada',
    kind: 'purchase',
    installmentAmount: 150,
    installmentCount: 10,
    installmentIds: Array.from({ length: 10 }, (_, i) => `tx-${i}`),
  });

  expect(plan.totalAmount).toBe(1500);
  const installments =
    await transactionRepository.findByInstallmentPlanId('plan-1');
  expect(installments.every((t) => t.amount === 150)).toBe(true);
});

it('still uses totalAmount directly when installmentAmount is not given (existing behavior unchanged)', async () => {
  const installmentPlanRepository = new FakeInstallmentPlanRepository();
  const transactionRepository = new FakeTransactionRepository();
  const accountRepository = new FakeAccountRepository();
  const categoryRepository = new FakeCategoryRepository();

  await accountRepository.save(
    new Account({
      id: 'acc-1',
      userId: 'user-1',
      name: 'Conta',
      type: 'checking',
      balance: 1000,
      currency: 'BRL',
      archived: false,
      hidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );

  const useCase = new CreateInstallmentPlanUseCase(
    installmentPlanRepository,
    transactionRepository,
    accountRepository,
    categoryRepository,
  );

  const plan = await useCase.execute({
    id: 'plan-2',
    userId: 'user-1',
    accountId: 'acc-1',
    description: 'Compra parcelada',
    kind: 'purchase',
    totalAmount: 1000,
    installmentCount: 3,
    installmentIds: ['tx-a', 'tx-b', 'tx-c'],
  });

  expect(plan.totalAmount).toBe(1000);
});
```

And in the schema test file (check if `create-installment-plan.schema.test.ts` exists; create it if not, following this plan's other schema-test patterns):

```ts
import { describe, expect, it } from 'vitest';

import { createInstallmentPlanSchema } from '@/modules/installments/schemas/create-installment-plan.schema';

describe('createInstallmentPlanSchema', () => {
  const base = {
    accountId: '11111111-1111-1111-1111-111111111111',
    description: 'Compra',
    installmentCount: 3,
  };

  it('accepts totalAmount alone', () => {
    const result = createInstallmentPlanSchema.safeParse({
      ...base,
      totalAmount: '300',
    });
    expect(result.success).toBe(true);
  });

  it('accepts installmentAmount alone', () => {
    const result = createInstallmentPlanSchema.safeParse({
      ...base,
      installmentAmount: '100',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when both are provided', () => {
    const result = createInstallmentPlanSchema.safeParse({
      ...base,
      totalAmount: '300',
      installmentAmount: '100',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when neither is provided', () => {
    const result = createInstallmentPlanSchema.safeParse(base);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/modules/installments/schemas/create-installment-plan.schema.test.ts src/modules/installments/application/create-installment-plan.use-case.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the schema**

```ts
import { z } from 'zod';

export const createInstallmentPlanSchema = z
  .object({
    accountId: z.uuid('Selecione uma conta.'),
    categoryId: z
      .uuid('Categoria inválida.')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    description: z.string().trim().min(1, 'Informe uma descrição.').max(255),
    totalAmount: z.coerce
      .number()
      .positive('O valor deve ser maior que zero.')
      .optional(),
    installmentAmount: z.coerce
      .number()
      .positive('O valor deve ser maior que zero.')
      .optional(),
    installmentCount: z.coerce
      .number()
      .int()
      .min(2, 'Um parcelamento precisa de pelo menos 2 parcelas.')
      .max(60, 'Máximo de 60 parcelas.'),
    startDate: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      (data.totalAmount !== undefined) !==
      (data.installmentAmount !== undefined),
    {
      message: 'Informe o valor total ou o valor da parcela — não os dois.',
      path: ['totalAmount'],
    },
  );

export type CreateInstallmentPlanSchema = z.infer<
  typeof createInstallmentPlanSchema
>;
```

- [ ] **Step 4: Update the use-case**

In `src/modules/installments/application/create-installment-plan.use-case.ts`:

Change the input interface:

```ts
export interface CreateInstallmentPlanInput {
  id: string;
  userId: string;
  accountId: string;
  categoryId?: string;
  description: string;
  kind: InstallmentPlanKind;
  /** Purchase: the total price. Loan: the principal borrowed. Provide this OR `installmentAmount`. */
  totalAmount?: number;
  /** Per-installment value — provide this OR `totalAmount`; the other is derived. Purchases only (loans always specify totalAmount, since interest makes a flat per-installment value meaningless before amortization is computed). */
  installmentAmount?: number;
  installmentCount: number;
  interestRate?: number;
  startDate?: Date;
  installmentIds: string[];
}
```

Right after the existing `installmentIds.length !== installmentCount` validation (before constructing `InstallmentPlan`), add:

```ts
if (input.totalAmount === undefined && input.installmentAmount === undefined) {
  throw new DomainError(
    'Informe o valor total ou o valor da parcela.',
    'INSTALLMENT_AMOUNT_MISSING',
  );
}
const resolvedTotalAmount =
  input.totalAmount ?? input.installmentAmount! * input.installmentCount;
```

Then use `resolvedTotalAmount` (not `input.totalAmount`) when constructing `plan`:

```ts
const plan = new InstallmentPlan({
  id: input.id,
  userId: input.userId,
  accountId: input.accountId,
  categoryId: input.categoryId,
  description: input.description,
  kind: input.kind,
  totalAmount: resolvedTotalAmount,
  installmentCount: input.installmentCount,
  interestRate: input.interestRate,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

The rest of the use-case (amortization/splitEvenly, transaction materialization loop) is unchanged — it already reads `plan.totalAmount`, which now correctly reflects whichever input was given.

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npx vitest run src/modules/installments/schemas/create-installment-plan.schema.test.ts src/modules/installments/application/create-installment-plan.use-case.test.ts`
Expected: PASS (all new + pre-existing cases).

- [ ] **Step 6: Update the server action**

In `src/app/transactions/actions.ts`, `createInstallmentAction` currently does:

```ts
totalAmount: formData.get('amount'),
```

Change to read a new `amountMode` field (added by Task 7's form) and route the value to the right schema key:

```ts
const amountMode =
  formData.get('amountMode') === 'installment' ? 'installment' : 'total';
const amountValue = formData.get('amount');

const parsed = createInstallmentPlanSchema.safeParse({
  accountId: formData.get('accountId'),
  categoryId: formData.get('categoryId'),
  description: formData.get('description'),
  totalAmount: amountMode === 'total' ? amountValue : undefined,
  installmentAmount: amountMode === 'installment' ? amountValue : undefined,
  installmentCount: formData.get('installmentCount'),
  startDate: formData.get('occurredAt') || undefined,
});
```

And a few lines below, the `useCase.execute({...})` call already spreads `...parsed.data` — since `parsed.data` now has `totalAmount`/`installmentAmount` as optional fields matching the use-case's new input shape, no further change is needed there.

- [ ] **Step 7: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean. (`transaction-form.tsx` won't submit an `amountMode` field yet until Task 7 — that's fine, `formData.get('amountMode')` on a form that doesn't send it just falls back to `'total'`, preserving current behavior exactly until Task 7 lands.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: installment plans accept total amount or per-installment amount"
```

---

### Task 7: Transaction form — amount-mode toggle

**Files:**

- Modify: `src/app/transactions/transaction-form.tsx`

**Interfaces:**

- Consumes: `createInstallmentAction`'s new `amountMode` field (Task 6).

- [ ] **Step 1: Read the current file in full (live)**

- [ ] **Step 2: Add the amount-mode toggle, live-calculated preview**

Add a new piece of state and a hidden field, plus a small toggle UI, only shown when `installments && type === 'expense'`. Replace the existing amount `<Input>` block (currently a single field labeled "Valor total" when installments are active) with:

```tsx
const [amountMode, setAmountMode] = useState<'total' | 'installment'>('total');
const [amountValue, setAmountValue] = useState('');
const [installmentCountValue, setInstallmentCountValue] = useState(2);
```

(add these alongside the existing `type`/`installments` state declarations)

```tsx
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium" htmlFor="amount">
      {installments && type === 'expense'
        ? amountMode === 'total'
          ? 'Valor total'
          : 'Valor da parcela'
        : 'Valor'}
    </label>
    {installments && type === 'expense' && (
      <div className="flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => setAmountMode('total')}
          className={`rounded-full border px-2 py-0.5 ${amountMode === 'total' ? 'border-primary bg-primary/10' : 'border-input'}`}
        >
          Total
        </button>
        <button
          type="button"
          onClick={() => setAmountMode('installment')}
          className={`rounded-full border px-2 py-0.5 ${amountMode === 'installment' ? 'border-primary bg-primary/10' : 'border-input'}`}
        >
          Por parcela
        </button>
      </div>
    )}
  </div>
  <Input
    id="amount"
    name="amount"
    type="number"
    step="0.01"
    min="0.01"
    required
    value={amountValue}
    onChange={(event) => setAmountValue(event.target.value)}
  />
  {installments && type === 'expense' && amountValue && (
    <p className="text-muted-foreground text-xs">
      {amountMode === 'total'
        ? `≈ ${formatCurrency(Number(amountValue) / installmentCountValue)} por parcela`
        : `≈ ${formatCurrency(Number(amountValue) * installmentCountValue)} no total`}
    </p>
  )}
  {installments && type === 'expense' && (
    <input type="hidden" name="amountMode" value={amountMode} />
  )}
</div>
```

Add `import { formatCurrency } from '@/shared/lib/format-currency';` to the top imports.

Update the existing `installmentCount` `<Input>` to be controlled, wiring it to `installmentCountValue` (needed for the live preview above):

```tsx
<Input
  id="installmentCount"
  name="installmentCount"
  type="number"
  min="2"
  max="60"
  step="1"
  value={installmentCountValue}
  onChange={(event) =>
    setInstallmentCountValue(Number(event.target.value) || 2)
  }
  required
/>
```

(remove the old `defaultValue={2}` since it's now a controlled input with `value`)

- [ ] **Step 3: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/transactions/transaction-form.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 4: Manual QA note**

No component-testing library exists in this project (per Round 1's established constraint) — this step is documented as a manual-QA item for the final consolidated verification pass (Task 14's final step), not tested automatically here.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: transaction form lets installment amount be entered as total or per-installment"
```

---

### Task 8: Import preview — duplicate detection + `previewImportAction`

**Files:**

- Modify: `src/app/transactions/actions.ts`

**Interfaces:**

- Produces: `interface ImportPreviewRow { lineNumber: number; description: string; accountName: string; categoryName?: string; type: 'income' | 'expense'; amount: number; occurredAt: string; status: 'valid' | 'valid_possible_duplicate' | 'invalid'; reason?: string }`, `previewImportAction(_prev: ImportPreviewState, formData: FormData): Promise<ImportPreviewState>` where `ImportPreviewState = { success: boolean; error?: string; rows?: ImportPreviewRow[] }`. Consumed by Task 9 (preview UI) and Task 10 (`confirmImportAction`, same `ImportPreviewRow` shape for its input).

- [ ] **Step 1: Read the current `createImportAction` in full**

It already contains all the CSV parsing, header-matching, and row-validation logic this task reuses — re-read `src/app/transactions/actions.ts` in full before starting, since this task extracts and reuses that logic rather than duplicating it.

- [ ] **Step 2: Extract the shared row-validation logic**

The existing `createImportAction` has a per-row validation block (parsing `description`/`accountName`/`categoryName`/`type`/`amount`/`occurredAt`, matching account/category by name, collecting rejection reasons). Extract this into a standalone function `parseImportRow` usable by both the preview and confirm paths, returning a discriminated result instead of pushing directly into a `reasons` array:

```ts
interface ParsedImportRow {
  lineNumber: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  occurredAt: Date;
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
}

type ImportRowParseResult =
  | { ok: true; row: ParsedImportRow }
  | { ok: false; lineNumber: number; reason: string };

function parseImportRow(
  row: string[],
  lineNumber: number,
  columnIndexByKey: Map<ImportColumnKey, number>,
  accountByName: Map<string, { id: string; name: string }>,
  categoryByName: Map<string, { id: string; name: string }>,
): ImportRowParseResult {
  const field = (key: ImportColumnKey): string => {
    const columnIndex = columnIndexByKey.get(key);
    return columnIndex === undefined ? '' : (row[columnIndex] ?? '').trim();
  };

  const description = field('description');
  const accountName = field('account');
  const categoryName = field('category');
  const type = TYPE_LABEL_TO_TRANSACTION_TYPE[normalizeText(field('type'))];
  const amount = Number(field('amount').replace(',', '.'));
  const occurredAt = new Date(`${field('date')}T00:00:00`);

  if (type === 'transfer')
    return {
      ok: false,
      lineNumber,
      reason: 'transferências não são importadas',
    };
  if (type !== 'income' && type !== 'expense')
    return { ok: false, lineNumber, reason: 'tipo inválido' };
  if (!description) return { ok: false, lineNumber, reason: 'descrição vazia' };

  const account = accountByName.get(normalizeText(accountName));
  if (!account)
    return {
      ok: false,
      lineNumber,
      reason: `conta "${accountName}" não encontrada`,
    };

  const category = categoryName
    ? categoryByName.get(normalizeText(categoryName))
    : undefined;
  if (categoryName && !category) {
    return {
      ok: false,
      lineNumber,
      reason: `categoria "${categoryName}" não encontrada`,
    };
  }

  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, lineNumber, reason: 'valor inválido' };
  if (Number.isNaN(occurredAt.getTime()))
    return { ok: false, lineNumber, reason: 'data inválida' };

  return {
    ok: true,
    row: {
      lineNumber,
      description,
      amount,
      type,
      occurredAt,
      accountId: account.id,
      accountName: account.name,
      categoryId: category?.id,
      categoryName: category?.name,
    },
  };
}
```

This is a straight extraction of `createImportAction`'s existing per-row logic — no behavior change. `createImportAction` itself will be refactored in Task 10 to call this function instead of inlining the same checks (do that refactor now, in this task, so there's exactly one copy of this logic from this point forward — leaving two copies until Task 10 would violate DRY for the whole gap between tasks).

- [ ] **Step 3: Refactor `createImportAction` to use `parseImportRow`**

Replace `createImportAction`'s inline per-row block with a call to `parseImportRow`, keeping everything else (the `withTransaction`/`CreateTransactionUseCase` loop, the summary message building) unchanged:

```ts
for (const [rowIndex, row] of dataRows.entries()) {
  const lineNumber = rowIndex + 2;
  const result = parseImportRow(
    row,
    lineNumber,
    columnIndexByKey,
    accountByName,
    categoryByName,
  );

  if (!result.ok) {
    reasons.push(`linha ${result.lineNumber}: ${result.reason}`);
    continue;
  }

  try {
    await withTransaction(async (tx) => {
      const useCase = new CreateTransactionUseCase(
        new DrizzleTransactionRepository(tx),
        new DrizzleAccountRepository(tx),
        new DrizzleCategoryRepository(tx),
      );
      await useCase.execute({
        id: randomUUID(),
        userId,
        accountId: result.row.accountId,
        categoryId: result.row.categoryId,
        description: result.row.description,
        amount: result.row.amount,
        type: result.row.type,
        occurredAt: result.row.occurredAt,
      });
    });
    imported += 1;
  } catch (error) {
    reasons.push(`linha ${lineNumber}: ${toUserMessage(error)}`);
  }
}
```

- [ ] **Step 4: Add `previewImportAction`**

```ts
export interface ImportPreviewRow {
  lineNumber: number;
  description: string;
  accountId: string;
  accountName: string;
  categoryId?: string;
  categoryName?: string;
  type: 'income' | 'expense';
  amount: number;
  occurredAt: string; // ISO date, for JSON round-trip to the client and back
  status: 'valid' | 'valid_possible_duplicate' | 'invalid';
  reason?: string;
}

export interface ImportPreviewState {
  success: boolean;
  error?: string;
  rows?: ImportPreviewRow[];
}

const IMPORT_PREVIEW_INITIAL_STATE: ImportPreviewState = { success: false };

/**
 * Parses and validates the uploaded CSV (same logic `createImportAction`
 * uses) but persists nothing — returns every row's status for the client
 * to render as a preview. Duplicate detection: a `valid` row whose account,
 * exact amount, and date (±1 day) already match an existing transaction is
 * marked `valid_possible_duplicate` rather than `invalid` — the user
 * decides whether to import it anyway in the preview UI.
 */
export async function previewImportAction(
  _prev: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: 'Selecione um arquivo CSV.' };
  }

  const text = await file.text();
  const rows = parseCsv(text).filter((row) =>
    row.some((field) => field.trim() !== ''),
  );
  if (rows.length === 0) {
    return { success: false, error: 'O arquivo está vazio.' };
  }

  const [header, ...dataRows] = rows;
  const columnIndexByKey = new Map<ImportColumnKey, number>();
  header.forEach((cell, index) => {
    const key = IMPORT_HEADER_KEYS[normalizeText(cell)];
    if (key) columnIndexByKey.set(key, index);
  });

  const missingColumn = REQUIRED_IMPORT_COLUMNS.find(
    (key) => !columnIndexByKey.has(key),
  );
  if (missingColumn) {
    return {
      success: false,
      error:
        'Cabeçalho do CSV inválido. Use o mesmo formato do arquivo exportado.',
    };
  }

  const userId = await requireCurrentUserId();

  const [accounts, categories, existingTransactions] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetTransactionsUseCase(new DrizzleTransactionRepository()).execute(
      userId,
      { pageSize: 10_000 },
    ),
  ]);
  const accountByName = new Map(
    accounts.map((a) => [normalizeText(a.name), a]),
  );
  const categoryByName = new Map(
    categories.map((c) => [normalizeText(c.name), c]),
  );

  const previewRows: ImportPreviewRow[] = dataRows.map((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    const result = parseImportRow(
      row,
      lineNumber,
      columnIndexByKey,
      accountByName,
      categoryByName,
    );

    if (!result.ok) {
      return {
        lineNumber: result.lineNumber,
        description: '',
        accountId: '',
        accountName: '',
        type: 'expense',
        amount: 0,
        occurredAt: '',
        status: 'invalid',
        reason: result.reason,
      };
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const isDuplicate = existingTransactions.some(
      (t) =>
        t.accountId === result.row.accountId &&
        t.amount === result.row.amount &&
        Math.abs(t.occurredAt.getTime() - result.row.occurredAt.getTime()) <=
          ONE_DAY_MS,
    );

    return {
      lineNumber: result.row.lineNumber,
      description: result.row.description,
      accountId: result.row.accountId,
      accountName: result.row.accountName,
      categoryId: result.row.categoryId,
      categoryName: result.row.categoryName,
      type: result.row.type,
      amount: result.row.amount,
      occurredAt: result.row.occurredAt.toISOString(),
      status: isDuplicate ? 'valid_possible_duplicate' : 'valid',
    };
  });

  return { success: true, rows: previewRows };
}
```

Add the new import at the top: `import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';` (check it isn't already imported before adding a duplicate).

- [ ] **Step 5: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/transactions/actions.ts --max-warnings=0`
Expected: clean.

- [ ] **Step 6: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean (no existing tests reference `createImportAction`'s internals directly, so the refactor should be invisible to the suite — if any test does, adjust it to match the new `parseImportRow` extraction without changing its assertions' intent).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add previewImportAction with duplicate detection, extract shared row parser"
```

---

### Task 9: Import preview UI

**Files:**

- Create: `src/app/transactions/import-preview-table.tsx`

**Interfaces:**

- Consumes: `ImportPreviewRow`/`ImportPreviewState` (Task 8).
- Produces: `ImportPreviewTable` component, `{ rows: ImportPreviewRow[]; onConfirm: (selectedRows: ImportPreviewRow[]) => void; onCancel: () => void; isConfirming: boolean }`. Consumed by Task 10 (wired into `ImportDialog`).

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

import type { ImportPreviewRow } from './actions';

interface ImportPreviewTableProps {
  rows: ImportPreviewRow[];
  onConfirm: (selectedRows: ImportPreviewRow[]) => void;
  onCancel: () => void;
  isConfirming: boolean;
}

/**
 * Renders the parsed-but-not-yet-persisted CSV rows: valid rows are
 * pre-checked, possible-duplicate rows are pre-unchecked (the user opts in
 * to importing them anyway), invalid rows are shown disabled with their
 * rejection reason. Nothing is persisted until `onConfirm` fires with the
 * rows the user kept checked.
 */
export function ImportPreviewTable({
  rows,
  onConfirm,
  onCancel,
  isConfirming,
}: ImportPreviewTableProps) {
  const [checked, setChecked] = useState<Set<number>>(
    () =>
      new Set(
        rows.filter((r) => r.status === 'valid').map((r) => r.lineNumber),
      ),
  );

  function toggle(lineNumber: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(lineNumber)) next.delete(lineNumber);
      else next.add(lineNumber);
      return next;
    });
  }

  const selectedRows = rows.filter(
    (r) => r.status !== 'invalid' && checked.has(r.lineNumber),
  );
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {selectedRows.length} de {rows.length} linhas serão importadas
        {invalidCount > 0
          ? ` (${invalidCount} inválida${invalidCount === 1 ? '' : 's'})`
          : ''}
        .
      </p>

      <div className="max-h-80 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <label
            key={row.lineNumber}
            className={`ledger-row flex items-center gap-2 text-sm ${
              row.status === 'invalid' ? 'text-muted-foreground opacity-60' : ''
            }`}
          >
            <input
              type="checkbox"
              disabled={row.status === 'invalid'}
              checked={checked.has(row.lineNumber)}
              onChange={() => toggle(row.lineNumber)}
              className="border-input h-4 w-4 rounded"
            />
            <span className="flex-1 truncate">
              {row.status === 'invalid'
                ? `Linha ${row.lineNumber}: ${row.reason}`
                : row.description}
              {row.status === 'valid_possible_duplicate' && (
                <span className="text-warning ml-2 text-xs">
                  possível duplicata
                </span>
              )}
            </span>
            {row.status !== 'invalid' && (
              <>
                <span className="text-muted-foreground text-xs">
                  {formatDate(new Date(row.occurredAt))}
                </span>
                <span className="ledger-figure">
                  {formatCurrency(row.amount)}
                </span>
              </>
            )}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isConfirming}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(selectedRows)}
          disabled={isConfirming || selectedRows.length === 0}
        >
          {isConfirming ? 'Importando…' : `Importar ${selectedRows.length}`}
        </Button>
      </div>
    </div>
  );
}
```

Check `src/components/ui/badge.tsx`/existing `text-warning` token usage elsewhere in the codebase before using `text-warning` — if that exact utility class isn't already an established token in `globals.css`/Tailwind config, substitute an existing warning-toned class already used elsewhere in this project (e.g. check how `toast`'s `warning` variant is styled in `src/shared/hooks/use-toast.ts`'s consumer, or fall back to `text-muted-foreground` with a distinguishing icon/prefix like "⚠ possível duplicata" if no warning color token exists).

- [ ] **Step 2: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/transactions/import-preview-table.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 3: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add ImportPreviewTable component"
```

---

### Task 10: `confirmImportAction` + wire the two-step flow into `ImportDialog`

**Files:**

- Modify: `src/app/transactions/actions.ts`
- Modify: `src/app/transactions/import-dialog.tsx`

**Interfaces:**

- Consumes: `ImportPreviewRow`, `previewImportAction` (Task 8), `ImportPreviewTable` (Task 9), `DialogForm` (Round 1, `src/components/ui/dialog-form.tsx`).
- Produces: `confirmImportAction(rows: ImportPreviewRow[]): Promise<ActionResult>`.

- [ ] **Step 1: Add `confirmImportAction`**

In `src/app/transactions/actions.ts`, add (this is a plain async function taking the selected rows directly, not a `useActionState`-shaped action, since Task 9's `ImportPreviewTable` calls it via a normal event handler, not a `<form action>`):

```ts
/**
 * Persists exactly the rows the user kept checked in the preview
 * (`ImportPreviewTable`) — already fully validated by `previewImportAction`,
 * so this does not re-parse the CSV, only re-runs `CreateTransactionUseCase`
 * per row (one `withTransaction` each, so one bad row can't roll back the
 * others — matches `createImportAction`'s existing behavior).
 */
export async function confirmImportAction(
  rows: ImportPreviewRow[],
): Promise<ActionResult> {
  try {
    const userId = await requireCurrentUserId();
    let imported = 0;
    const reasons: string[] = [];

    for (const row of rows) {
      try {
        await withTransaction(async (tx) => {
          const useCase = new CreateTransactionUseCase(
            new DrizzleTransactionRepository(tx),
            new DrizzleAccountRepository(tx),
            new DrizzleCategoryRepository(tx),
          );
          await useCase.execute({
            id: randomUUID(),
            userId,
            accountId: row.accountId,
            categoryId: row.categoryId,
            description: row.description,
            amount: row.amount,
            type: row.type,
            occurredAt: new Date(row.occurredAt),
          });
        });
        imported += 1;
      } catch (error) {
        reasons.push(`linha ${row.lineNumber}: ${toUserMessage(error)}`);
      }
    }

    if (imported > 0) revalidateMoneyPages();

    const summary = `${imported} importada${imported === 1 ? '' : 's'}, ${reasons.length} ignorada${reasons.length === 1 ? '' : 's'}`;
    const message =
      reasons.length > 0
        ? `${summary} (${reasons.slice(0, 5).join('; ')}${reasons.length > 5 ? '…' : ''})`
        : summary;

    return { success: true, message };
  } catch (error) {
    return { success: false, error: toUserMessage(error) };
  }
}
```

- [ ] **Step 2: Rewrite `ImportDialog` for the two-step flow**

Read the current `src/app/transactions/import-dialog.tsx` in full (Round 1 migrated it to `DialogForm`). Replace its body: step 1 uses `DialogForm` with `previewImportAction` exactly as it already does today (same file-upload form), but instead of `DialogForm` auto-closing on "success" (which previously meant "imported"), success now means "preview ready" — render `ImportPreviewTable` inside the same open dialog instead of closing, then call `confirmImportAction` directly on the preview table's `onConfirm`.

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';

import {
  type ImportPreviewRow,
  type ImportPreviewState,
  confirmImportAction,
  previewImportAction,
} from '@/app/transactions/actions';
import { ImportPreviewTable } from '@/app/transactions/import-preview-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { toast } from '@/shared/hooks/use-toast';

const INITIAL_STATE: ImportPreviewState = { success: false };

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[] | null>(
    null,
  );
  const [isConfirming, startConfirming] = useTransition();

  function handleConfirm(selectedRows: ImportPreviewRow[]) {
    startConfirming(async () => {
      const result = await confirmImportAction(selectedRows);
      toast({
        title:
          result.message ??
          (result.success
            ? 'Importação concluída.'
            : (result.error ?? 'Erro ao importar.')),
        variant: result.success ? 'success' : 'error',
      });
      if (result.success) {
        setOpen(false);
        setPreviewRows(null);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setPreviewRows(null);
          setOpen(true);
        }}
      >
        Importar CSV
      </Button>
      <DialogForm
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPreviewRows(null);
        }}
        action={previewImportAction}
        initialState={INITIAL_STATE}
        onSuccess={(state) => {
          if (state.rows) setPreviewRows(state.rows);
        }}
      >
        {({ state, formAction }) =>
          previewRows ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar importação</DialogTitle>
                <DialogDescription>
                  Revise as linhas antes de confirmar.
                </DialogDescription>
              </DialogHeader>
              <ImportPreviewTable
                rows={previewRows}
                onConfirm={handleConfirm}
                onCancel={() => setPreviewRows(null)}
                isConfirming={isConfirming}
              />
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Importar transações</DialogTitle>
                <DialogDescription>
                  Envie um CSV no formato exportado (Data, Descrição, Conta,
                  Categoria, Tipo, Valor). Conta e categoria são casadas pelo
                  nome. Transferências não são importadas.
                </DialogDescription>
              </DialogHeader>
              <form action={formAction} className="space-y-4">
                {state.error && (
                  <Alert variant="error">
                    <AlertDescription>{state.error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="import-file">
                    Arquivo CSV
                  </label>
                  <input
                    id="import-file"
                    name="file"
                    type="file"
                    accept=".csv,text/csv"
                    required
                    className={FIELD_BASE_CLASSES}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <SubmitButton />
                </DialogFooter>
              </form>
            </>
          )
        }
      </DialogForm>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Analisando…' : 'Avançar'}
    </Button>
  );
}
```

Note: `DialogForm`'s automatic close-on-`state.success` (from Round 1) would normally close the dialog the instant `previewImportAction` returns `success: true` — but here "success" means "preview ready," not "done." Check `src/components/ui/dialog-form.tsx`'s exact behavior (Round 1's implementation) before finalizing this step: if it unconditionally closes on `state.success`, you need to prevent that specifically for this dialog. The cleanest fix, given `DialogForm`'s existing API (`onSuccess` callback), is: `DialogForm` should NOT auto-close for this use — check whether it exposes a way to opt out (e.g. a prop), and if not, this is a legitimate, narrow extension to `DialogForm` itself (add an optional `closeOnSuccess?: boolean` prop, default `true`, and pass `closeOnSuccess={false}` here) rather than fighting the primitive from outside. If you add this prop, it's an additive, backward-compatible change — every other `DialogForm` consumer keeps working with no changes, since the default stays `true`.

- [ ] **Step 3: If `DialogForm` needed the `closeOnSuccess` prop added, verify no regression in Round 1's dialogs**

Run: `grep -rln "DialogForm" src/app/transactions` and confirm every other consumer (`transaction-edit-dialog.tsx`, `recurring-transaction-form-dialog.tsx`) still closes on success as before (they don't pass `closeOnSuccess`, so they get the default `true` — no behavior change for them).

- [ ] **Step 4: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/transactions/actions.ts src/app/transactions/import-dialog.tsx src/components/ui/dialog-form.tsx --max-warnings=0`
Expected: clean.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: two-step CSV import (preview + duplicate warnings, then confirm)"
```

---

### Task 11: `user_view_preferences` schema + repository + fakes

**Files:**

- Modify: `src/infra/database/schema.ts`
- Create: `src/core/entities/view-preference.ts`
- Create: `src/core/contracts/view-preference-repository.ts`
- Create: `src/infra/repositories/drizzle-view-preference.repository.ts`
- Create: `src/tests/fakes/fake-view-preference.repository.ts`

**Interfaces:**

- Produces: `ViewPreference { id, userId, screenKey, viewMode, createdAt, updatedAt }`, `ViewPreferenceRepository { findByUserAndScreen(userId, screenKey): Promise<ViewPreference | null>; save(preference: ViewPreference): Promise<void> }`. Consumed by Task 12.

- [ ] **Step 1: Add the table to `schema.ts`**

Read `src/infra/database/schema.ts` in full (live — other tasks in prior rounds have grown it). Add, following the existing table style exactly (see `budgets`/`recurringTransactions` for the closest analogues):

```ts
/**
 * A user's chosen way to view a listing screen — deliberately generic
 * (`screenKey` + `viewMode` as free-form strings, not an enum tied to one
 * screen) so a future screen can reuse this table with its own key and
 * view-mode vocabulary without a new migration.
 */
export const userViewPreferences = pgTable(
  'user_view_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    screenKey: varchar('screen_key', { length: 64 }).notNull(),
    viewMode: varchar('view_mode', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('user_view_preferences_user_screen_idx').on(
      table.userId,
      table.screenKey,
    ),
  ],
);
```

Add `uniqueIndex` to the existing `drizzle-orm/pg-core` import list at the top of the file if it's not already imported (check first).

- [ ] **Step 2: Generate and apply the migration**

Run: `npx drizzle-kit generate` then `docker compose up -d && pnpm db:migrate`.
Expected: a new migration file with a single `CREATE TABLE` + unique index, applied successfully.

- [ ] **Step 3: Entity**

```ts
import { ValidationError } from '@/core/errors/validation-error';

export interface ViewPreferenceProps {
  id: string;
  userId: string;
  screenKey: string;
  viewMode: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A user's saved display preference for one screen. `screenKey`/`viewMode`
 * are free-form strings validated by the calling use-case (which knows the
 * valid values for its own screen) — this entity only enforces they're
 * non-empty, keeping it reusable across screens with different vocabularies. */
export class ViewPreference {
  constructor(public readonly props: ViewPreferenceProps) {
    if (!props.screenKey.trim()) {
      throw new ValidationError('View preference screenKey is required.');
    }
    if (!props.viewMode.trim()) {
      throw new ValidationError('View preference viewMode is required.');
    }
  }

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get screenKey() {
    return this.props.screenKey;
  }
  get viewMode() {
    return this.props.viewMode;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
```

- [ ] **Step 4: Contract**

```ts
import type { ViewPreference } from '@/core/entities/view-preference';

export interface ViewPreferenceRepository {
  findByUserAndScreen(
    userId: string,
    screenKey: string,
  ): Promise<ViewPreference | null>;
  save(preference: ViewPreference): Promise<void>;
}
```

- [ ] **Step 5: Drizzle implementation**

```ts
import { and, eq } from 'drizzle-orm';

import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import { ViewPreference } from '@/core/entities/view-preference';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { userViewPreferences } from '@/infra/database/schema';

type ViewPreferenceRow = typeof userViewPreferences.$inferSelect;

function toDomain(row: ViewPreferenceRow): ViewPreference {
  return new ViewPreference({
    id: row.id,
    userId: row.userId,
    screenKey: row.screenKey,
    viewMode: row.viewMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleViewPreferenceRepository implements ViewPreferenceRepository {
  constructor(private readonly executor: Executor = db) {}

  async findByUserAndScreen(
    userId: string,
    screenKey: string,
  ): Promise<ViewPreference | null> {
    const [row] = await this.executor
      .select()
      .from(userViewPreferences)
      .where(
        and(
          eq(userViewPreferences.userId, userId),
          eq(userViewPreferences.screenKey, screenKey),
        ),
      )
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async save(preference: ViewPreference): Promise<void> {
    const values = {
      userId: preference.userId,
      screenKey: preference.screenKey,
      viewMode: preference.viewMode,
      updatedAt: preference.props.updatedAt,
    };

    await this.executor
      .insert(userViewPreferences)
      .values({
        ...values,
        id: preference.id,
        createdAt: preference.props.createdAt,
      })
      .onConflictDoUpdate({
        target: [userViewPreferences.userId, userViewPreferences.screenKey],
        set: values,
      });
  }
}
```

- [ ] **Step 6: Fake repository**

Read `src/tests/fakes/fake-category.repository.ts` (or any other simple fake) first to match this project's fake-repository style exactly, then write:

```ts
import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import type { ViewPreference } from '@/core/entities/view-preference';

export class FakeViewPreferenceRepository implements ViewPreferenceRepository {
  private preferences: ViewPreference[] = [];

  async findByUserAndScreen(
    userId: string,
    screenKey: string,
  ): Promise<ViewPreference | null> {
    return (
      this.preferences.find(
        (p) => p.userId === userId && p.screenKey === screenKey,
      ) ?? null
    );
  }

  async save(preference: ViewPreference): Promise<void> {
    const index = this.preferences.findIndex(
      (p) =>
        p.userId === preference.userId && p.screenKey === preference.screenKey,
    );
    if (index === -1) this.preferences.push(preference);
    else this.preferences[index] = preference;
  }
}
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add user_view_preferences table, entity, repository, and fake"
```

---

### Task 12: `GetViewPreferenceUseCase` / `SetViewPreferenceUseCase`

**Files:**

- Create: `src/modules/preferences/application/get-view-preference.use-case.ts` + `.test.ts`
- Create: `src/modules/preferences/application/set-view-preference.use-case.ts` + `.test.ts`

**Interfaces:**

- Consumes: `ViewPreferenceRepository` (Task 11).
- Produces: `GetViewPreferenceUseCase.execute(userId, screenKey, defaultViewMode): Promise<string>` (returns the saved mode, or `defaultViewMode` if none saved — never `null`, so callers never need a fallback branch). `SetViewPreferenceUseCase.execute(input: { userId; screenKey; viewMode }): Promise<void>`. Consumed by Task 13 (`preferences-actions.ts`) and Task 14 (`/transactions` page read).

- [ ] **Step 1: Write the failing tests**

```ts
// get-view-preference.use-case.test.ts
import { describe, expect, it } from 'vitest';

import { GetViewPreferenceUseCase } from '@/modules/preferences/application/get-view-preference.use-case';
import { ViewPreference } from '@/core/entities/view-preference';
import { FakeViewPreferenceRepository } from '@/tests/fakes/fake-view-preference.repository';

describe('GetViewPreferenceUseCase', () => {
  it('returns the default when no preference has been saved', async () => {
    const repository = new FakeViewPreferenceRepository();
    const result = await new GetViewPreferenceUseCase(repository).execute(
      'user-1',
      'transactions',
      'chronological',
    );
    expect(result).toBe('chronological');
  });

  it('returns the saved preference when one exists', async () => {
    const repository = new FakeViewPreferenceRepository();
    await repository.save(
      new ViewPreference({
        id: 'pref-1',
        userId: 'user-1',
        screenKey: 'transactions',
        viewMode: 'grouped_by_category',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const result = await new GetViewPreferenceUseCase(repository).execute(
      'user-1',
      'transactions',
      'chronological',
    );
    expect(result).toBe('grouped_by_category');
  });
});
```

```ts
// set-view-preference.use-case.test.ts
import { describe, expect, it } from 'vitest';

import { SetViewPreferenceUseCase } from '@/modules/preferences/application/set-view-preference.use-case';
import { FakeViewPreferenceRepository } from '@/tests/fakes/fake-view-preference.repository';

describe('SetViewPreferenceUseCase', () => {
  it('creates a new preference', async () => {
    const repository = new FakeViewPreferenceRepository();
    await new SetViewPreferenceUseCase(repository).execute({
      userId: 'user-1',
      screenKey: 'transactions',
      viewMode: 'grouped_by_month',
    });
    const saved = await repository.findByUserAndScreen(
      'user-1',
      'transactions',
    );
    expect(saved?.viewMode).toBe('grouped_by_month');
  });

  it('updates an existing preference for the same user+screen', async () => {
    const repository = new FakeViewPreferenceRepository();
    const useCase = new SetViewPreferenceUseCase(repository);
    await useCase.execute({
      userId: 'user-1',
      screenKey: 'transactions',
      viewMode: 'chronological',
    });
    await useCase.execute({
      userId: 'user-1',
      screenKey: 'transactions',
      viewMode: 'grouped_by_category',
    });

    const saved = await repository.findByUserAndScreen(
      'user-1',
      'transactions',
    );
    expect(saved?.viewMode).toBe('grouped_by_category');
  });

  it('rejects an empty viewMode', async () => {
    const repository = new FakeViewPreferenceRepository();
    await expect(
      new SetViewPreferenceUseCase(repository).execute({
        userId: 'user-1',
        screenKey: 'transactions',
        viewMode: '',
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/modules/preferences/application/get-view-preference.use-case.test.ts src/modules/preferences/application/set-view-preference.use-case.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// get-view-preference.use-case.ts
import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';

export class GetViewPreferenceUseCase {
  constructor(
    private readonly viewPreferenceRepository: ViewPreferenceRepository,
  ) {}

  async execute(
    userId: string,
    screenKey: string,
    defaultViewMode: string,
  ): Promise<string> {
    const preference = await this.viewPreferenceRepository.findByUserAndScreen(
      userId,
      screenKey,
    );
    return preference?.viewMode ?? defaultViewMode;
  }
}
```

```ts
// set-view-preference.use-case.ts
import { randomUUID } from 'node:crypto';

import type { ViewPreferenceRepository } from '@/core/contracts/view-preference-repository';
import { ViewPreference } from '@/core/entities/view-preference';

export interface SetViewPreferenceInput {
  userId: string;
  screenKey: string;
  viewMode: string;
}

export class SetViewPreferenceUseCase {
  constructor(
    private readonly viewPreferenceRepository: ViewPreferenceRepository,
  ) {}

  async execute(input: SetViewPreferenceInput): Promise<void> {
    const existing = await this.viewPreferenceRepository.findByUserAndScreen(
      input.userId,
      input.screenKey,
    );
    const now = new Date();

    const preference = new ViewPreference({
      id: existing?.id ?? randomUUID(),
      userId: input.userId,
      screenKey: input.screenKey,
      viewMode: input.viewMode,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    await this.viewPreferenceRepository.save(preference);
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/modules/preferences/application/get-view-preference.use-case.test.ts src/modules/preferences/application/set-view-preference.use-case.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add GetViewPreferenceUseCase and SetViewPreferenceUseCase"
```

---

### Task 13: Grouping functions for category/month + `setViewPreferenceAction`

**Files:**

- Create: `src/shared/lib/group-transactions-by-category.ts` + `.test.ts`
- Create: `src/shared/lib/group-transactions-by-month.ts` + `.test.ts`
- Create: `src/app/transactions/preferences-actions.ts`

**Interfaces:**

- Produces: `groupTransactionsByCategory<T extends { categoryId?: string; categoryName?: string }>(items: T[]): Array<{ label: string; items: T[] }>` (sorted by group total descending — biggest category first; a `categoryId === undefined` group labeled "Sem categoria" sorts last regardless of its total). `groupTransactionsByMonth<T extends { occurredAt: Date }>(items: T[]): Array<{ label: string; items: T[] }>` (labels like "Agosto de 2026", newest month first — assumes input is pre-sorted newest-first, same precondition as Round 1's `groupTransactionsByPeriod`). `setViewPreferenceAction(screenKey: string, viewMode: string): Promise<void>`. Consumed by Task 14.

- [ ] **Step 1: Write the failing tests for `groupTransactionsByCategory`**

```ts
import { describe, expect, it } from 'vitest';

import { groupTransactionsByCategory } from '@/shared/lib/group-transactions-by-category';

interface Item {
  categoryId?: string;
  categoryName?: string;
  amount: number;
}

describe('groupTransactionsByCategory', () => {
  it('groups items by categoryName, sorted by group total descending', () => {
    const items: Item[] = [
      { categoryId: 'c1', categoryName: 'Alimentação', amount: 100 },
      { categoryId: 'c2', categoryName: 'Transporte', amount: 500 },
      { categoryId: 'c1', categoryName: 'Alimentação', amount: 50 },
    ];

    const groups = groupTransactionsByCategory(items);

    expect(groups.map((g) => g.label)).toEqual(['Transporte', 'Alimentação']);
    expect(groups[1].items).toHaveLength(2);
  });

  it('puts uncategorized items in a "Sem categoria" group, sorted last regardless of total', () => {
    const items: Item[] = [
      { categoryId: undefined, categoryName: undefined, amount: 1000 },
      { categoryId: 'c1', categoryName: 'Alimentação', amount: 10 },
    ];

    const groups = groupTransactionsByCategory(items);

    expect(groups.map((g) => g.label)).toEqual([
      'Alimentação',
      'Sem categoria',
    ]);
  });

  it('handles an empty list', () => {
    expect(groupTransactionsByCategory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run src/shared/lib/group-transactions-by-category.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `groupTransactionsByCategory`**

```ts
export interface CategoryGroup<T> {
  label: string;
  items: T[];
}

const UNCATEGORIZED_LABEL = 'Sem categoria';

/** Groups items by `categoryName` (falling back to "Sem categoria" when
 * `categoryId` is unset), ranked by each group's total `amount` descending
 * — the biggest-spend category first, matching how a "gastos por
 * categoria" view is naturally scanned. The uncategorized group always
 * sorts last, regardless of its total, since it isn't a real category to
 * rank against the others. */
export function groupTransactionsByCategory<
  T extends { categoryId?: string; categoryName?: string; amount: number },
>(items: T[]): CategoryGroup<T>[] {
  const groupsByLabel = new Map<string, T[]>();

  for (const item of items) {
    const label = item.categoryId
      ? (item.categoryName ?? UNCATEGORIZED_LABEL)
      : UNCATEGORIZED_LABEL;
    const group = groupsByLabel.get(label) ?? [];
    group.push(item);
    groupsByLabel.set(label, group);
  }

  const groups = Array.from(groupsByLabel.entries()).map(
    ([label, groupItems]) => ({
      label,
      items: groupItems,
      total: groupItems.reduce((sum, item) => sum + item.amount, 0),
    }),
  );

  groups.sort((a, b) => {
    if (a.label === UNCATEGORIZED_LABEL) return 1;
    if (b.label === UNCATEGORIZED_LABEL) return -1;
    return b.total - a.total;
  });

  return groups.map(({ label, items: groupItems }) => ({
    label,
    items: groupItems,
  }));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/shared/lib/group-transactions-by-category.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing tests for `groupTransactionsByMonth`**

```ts
import { describe, expect, it } from 'vitest';

import { groupTransactionsByMonth } from '@/shared/lib/group-transactions-by-month';

interface Item {
  occurredAt: Date;
}

describe('groupTransactionsByMonth', () => {
  it('groups items by month/year, newest first, assuming pre-sorted input', () => {
    const items: Item[] = [
      { occurredAt: new Date('2026-08-15T00:00:00.000Z') },
      { occurredAt: new Date('2026-08-01T00:00:00.000Z') },
      { occurredAt: new Date('2026-06-20T00:00:00.000Z') },
    ];

    const groups = groupTransactionsByMonth(items);

    expect(groups.map((g) => g.label)).toEqual([
      'Agosto de 2026',
      'Junho de 2026',
    ]);
    expect(groups[0].items).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(groupTransactionsByMonth([])).toEqual([]);
  });
});
```

- [ ] **Step 6: Run to confirm failure**

Run: `npx vitest run src/shared/lib/group-transactions-by-month.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement `groupTransactionsByMonth`**

```ts
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface MonthGroup<T> {
  label: string;
  items: T[];
}

/** Groups items by calendar month, labeled "Mês de Ano". Assumes `items`
 * is already sorted newest-first (same precondition as Round 1's
 * `groupTransactionsByPeriod`) — groups emit in first-seen order. */
export function groupTransactionsByMonth<T extends { occurredAt: Date }>(
  items: T[],
): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const indexByLabel = new Map<string, number>();

  for (const item of items) {
    const label = `${MONTH_NAMES[item.occurredAt.getMonth()]} de ${item.occurredAt.getFullYear()}`;
    const existingIndex = indexByLabel.get(label);

    if (existingIndex === undefined) {
      indexByLabel.set(label, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[existingIndex].items.push(item);
    }
  }

  return groups;
}
```

- [ ] **Step 8: Run tests to confirm they pass**

Run: `npx vitest run src/shared/lib/group-transactions-by-month.test.ts`
Expected: PASS, 2 tests.

Note: verify the `.getMonth()` value for the `2026-08-15T00:00:00.000Z`/`2026-06-20T00:00:00.000Z` fixtures against your actual local timezone the same way Round 1's `group-transactions-by-period.test.ts` did (`node -e "console.log(new Date('...').getMonth())"`) if the test fails — UTC-vs-local parsing of a midnight timestamp can shift the date by one day depending on the runner's timezone; adjust the fixture times (e.g. to `T12:00:00.000Z`) if needed, don't guess.

- [ ] **Step 9: `setViewPreferenceAction`**

```ts
'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/routes';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { SetViewPreferenceUseCase } from '@/modules/preferences/application/set-view-preference.use-case';

export async function setViewPreferenceAction(
  screenKey: string,
  viewMode: string,
): Promise<void> {
  const userId = await requireCurrentUserId();
  await new SetViewPreferenceUseCase(
    new DrizzleViewPreferenceRepository(),
  ).execute({
    userId,
    screenKey,
    viewMode,
  });
  revalidatePath(ROUTES.transactions);
}
```

- [ ] **Step 10: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/shared/lib/group-transactions-by-category.ts src/shared/lib/group-transactions-by-month.ts src/app/transactions/preferences-actions.ts --max-warnings=0`
Expected: clean.

- [ ] **Step 11: Whole-project verification**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0 && npx vitest run`
Expected: clean.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add category/month grouping functions and setViewPreferenceAction"
```

---

### Task 14: Wire the view-mode selector into `/transactions`

**Files:**

- Create: `src/app/transactions/view-mode-selector.tsx`
- Modify: `src/app/transactions/page.tsx`
- Modify: `src/app/transactions/transaction-list.tsx`

**Interfaces:**

- Consumes: `GetViewPreferenceUseCase` (Task 12), `setViewPreferenceAction` (Task 13), `groupTransactionsByCategory`/`groupTransactionsByMonth` (Task 13), Round 1's `groupTransactionsByPeriod` (existing, for the `'chronological'` mode).

- [ ] **Step 1: Read the current `page.tsx` and `transaction-list.tsx` in full (live)**

Both files have been touched by Round 1 and this round's Task 8 refactor context (actions.ts) — re-read live before editing.

- [ ] **Step 2: `ViewModeSelector` component**

```tsx
'use client';

import { useTransition } from 'react';

import { setViewPreferenceAction } from '@/app/transactions/preferences-actions';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

export type TransactionViewMode =
  'chronological' | 'grouped_by_category' | 'grouped_by_month';

const VIEW_MODE_LABELS: Record<TransactionViewMode, string> = {
  chronological: 'Cronológico',
  grouped_by_category: 'Por categoria',
  grouped_by_month: 'Por mês',
};

interface ViewModeSelectorProps {
  value: TransactionViewMode;
}

/** A tiny client island: changing the select persists the choice via
 * `setViewPreferenceAction` and reloads the page (the simplest way to get
 * a Server Component re-render with the new grouping applied, consistent
 * with this app's plain-GET-form-first approach elsewhere). */
export function ViewModeSelector({ value }: ViewModeSelectorProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      aria-label="Modo de visualização"
      className={FIELD_BASE_CLASSES}
      defaultValue={value}
      disabled={isPending}
      onChange={(event) => {
        const mode = event.target.value as TransactionViewMode;
        startTransition(async () => {
          await setViewPreferenceAction('transactions', mode);
          window.location.reload();
        });
      }}
    >
      {(Object.keys(VIEW_MODE_LABELS) as TransactionViewMode[]).map((mode) => (
        <option key={mode} value={mode}>
          {VIEW_MODE_LABELS[mode]}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: `page.tsx` reads the preference and passes `groupBy` down**

Add the fetch (alongside the existing `Promise.all` of accounts/categories/etc — read the current file to find that block):

```ts
const viewMode = (await new GetViewPreferenceUseCase(
  new DrizzleViewPreferenceRepository(),
).execute(userId, 'transactions', 'chronological')) as
  'chronological' | 'grouped_by_category' | 'grouped_by_month';
```

Add the corresponding imports. Render `<ViewModeSelector value={viewMode} />` near `TransactionsFilters`/`FilterChips` (same row or just below — match the existing layout's spacing conventions). Pass `groupBy={viewMode}` as a new prop to `<TransactionList>`.

- [ ] **Step 4: `TransactionList` uses the right grouping function**

Read `src/app/transactions/transaction-list.tsx` in full (live — Round 1's final corrective fix touched this file). Add a `groupBy: 'chronological' | 'grouped_by_category' | 'grouped_by_month'` prop to `TransactionListProps`. Where the component currently calls `groupTransactionsByPeriod(enriched, new Date())` to build `groups`, branch on `groupBy`:

```ts
const groups = useMemo(() => {
  if (groupBy === 'grouped_by_category')
    return groupTransactionsByCategory(enriched);
  if (groupBy === 'grouped_by_month') return groupTransactionsByMonth(enriched);
  return groupTransactionsByPeriod(enriched, new Date());
}, [enriched, groupBy]);
```

Add the two new imports (`groupTransactionsByCategory` from `@/shared/lib/group-transactions-by-category`, `groupTransactionsByMonth` from `@/shared/lib/group-transactions-by-month`). `EnrichedTransaction` (already has `categoryId`/`categoryName`/`amount`/`occurredAt`) already satisfies both new grouping functions' generic constraints — no further type changes needed.

- [ ] **Step 5: Typecheck, lint**

Run: `npx tsc --noEmit && npx eslint src/app/transactions --max-warnings=0`
Expected: clean.

- [ ] **Step 6: FINAL whole-project verification (this is the plan's single consolidated validation pass — run every check, thoroughly)**

Per the plan header's process note, this is the only point in the whole plan where full verification is expected to be exhaustively confirmed, since no individual task got its own review gate:

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npx vitest run
npx next build
```

Expected: every command clean, and the test count should be the pre-Round-2 baseline plus every new test file this plan added (Tasks 1, 2, 3, 6, 12, 13 each added tests — count them: 6 + 2 + 1 + ~6 + 5 + 5 = ~25 new tests on top of Round 1's ~108, so the suite should report roughly 130+ tests, all passing). If the count doesn't roughly match, something from an earlier task didn't actually land — investigate before proceeding, don't just move on because the numbers are "close enough."

- [ ] **Step 7: Manual QA (documented, not automated — no component-testing library in this project)**

With `pnpm dev` running and logged in: (a) create a 15x installment purchase, confirm the dashboard's "saldo atual" doesn't deduct the future installments while "projetado" does; (b) create an installment plan by typing the per-installment value instead of the total, confirm the live preview and the resulting plan's total match; (c) export a CSV, edit one row to exactly duplicate an existing transaction, re-import it, confirm the preview flags it as a possible duplicate and it's unchecked by default; (d) switch `/transactions`'s view mode to "Por categoria", reload the page, confirm the choice persisted.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire view-mode selector (chronological/category/month) into /transactions"
```

---

## Final Verification Checklist

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint src --max-warnings=0` clean
- [ ] `npx vitest run` — all tests pass (Round 1's baseline plus every test this plan added)
- [ ] `npx next build` succeeds
- [ ] Manual: 15x installment purchase → dashboard "saldo atual" excludes future installments, "projetado" includes them
- [ ] Manual: installment plan created via per-installment amount computes the correct total
- [ ] Manual: CSV re-import of a duplicate row is flagged in preview, unchecked by default
- [ ] Manual: `/transactions` view-mode choice persists across a reload
