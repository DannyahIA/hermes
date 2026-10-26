import type { AccountRepository } from '@/core/contracts/account-repository';
import type { BudgetRepository } from '@/core/contracts/budget-repository';
import type { CategoryRepository } from '@/core/contracts/category-repository';
import type { MerchantRuleRepository } from '@/core/contracts/merchant-rule-repository';
import type { RecurringTransactionRepository } from '@/core/contracts/recurring-transaction-repository';
import type { TransactionRepository } from '@/core/contracts/transaction-repository';
import type { Account } from '@/core/entities/account';
import type { Category } from '@/core/entities/category';
import type { Transaction } from '@/core/entities/transaction';
import { computeCurrentBalance } from '@/core/value-objects/current-balance';
import { netWorthContribution } from '@/core/value-objects/net-worth';
import type { AccountWithBalances } from '@/modules/accounts/application/get-accounts.use-case';
import { GetBudgetProgressUseCase } from '@/modules/budgets/application/get-budget-progress.use-case';
import {
  buildMerchantMemory,
  type MerchantMemoryEntry,
} from '@/modules/capture/domain/merchant-memory';
import type { QuickEntryAccount } from '@/modules/capture/domain/parse-quick-entry';
import { quickEntryAccounts } from '@/modules/capture/domain/quick-entry-accounts';
import {
  createCategorySuggester,
  SUGGESTION_HISTORY_DAYS,
} from '@/modules/categories/application/suggest-categories';
import { suggestNewCategories } from '@/modules/categories/application/suggest-new-categories';
import type { NewCategoryHint } from '@/modules/categories/domain/category-catalog';
import {
  calculateNetWorthByMonth,
  type NetWorthPoint,
} from '@/modules/reports/application/metrics/calculate-net-worth-by-month';

import {
  type AvailableToSpend,
  calculateAvailableToSpend,
} from './metrics/calculate-available-to-spend';
import {
  type BudgetPace,
  calculateBudgetPace,
} from './metrics/calculate-budget-pace';
import {
  calculateCardStatements,
  type CardStatement,
} from './metrics/calculate-card-statements';
import {
  calculateMonthToDate,
  type MonthToDate,
} from './metrics/calculate-month-to-date';
import { calculateUpcoming, type Upcoming } from './metrics/calculate-upcoming';
import {
  groupRecentByDay,
  type RecentDay,
} from './metrics/group-recent-by-day';

export interface DashboardSummary {
  netWorth: number;
  /** Net worth once every known future commitment (installments) has landed. */
  projectedNetWorth: number;
  /** Net worth at the end of each of the last months, this one as of today. */
  netWorthTrend: NetWorthPoint[];
  /** What's owed on visible credit cards today. */
  owedOnCards: number;
  accounts: Account[];
  accountBalances: AccountWithBalances[];
  /** Every not-yet-occurred transaction across all accounts. */
  futureTransactions: Transaction[];
  /** Every category, archived ones too, to name what's already filed under them. */
  categories: Category[];
  /** Uncategorized income and expenses of the last 30 days, newest first. */
  toReview: Transaction[];
  /** Up to three category ids per uncategorized transaction shown. */
  categorySuggestions: Record<string, string[]>;
  /** A common category the user does not have yet, per uncategorized transaction shown. */
  newCategorySuggestions: Record<string, NewCategoryHint>;
  /** Budgets running today, blown and ahead-of-pace first. */
  budgetPace: BudgetPace[];
  recentDays: RecentDay[];
  /** Null without a checking account to spend from. */
  availableToSpend: AvailableToSpend | null;
  monthToDate: MonthToDate;
  cardStatements: CardStatement[];
  upcoming: Upcoming;
  /** What the quick entry needs to understand a line as it is typed. */
  quickEntry: {
    accounts: QuickEntryAccount[];
    merchants: MerchantMemoryEntry[];
  };
}

const TREND_MONTHS = 6;
const REVIEW_DAYS = 30;
const RECENT_COUNT = 8;
/** Suggestions are worked out for the queue's first rows only. */
export const REVIEW_VISIBLE = 5;

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days);
}

/**
 * Everything the Início shows, in one call (spec
 * 2026-10-17-inicio-hub-design.md): what's still free to spend, the cards,
 * what comes next, what needs a category, how budgets are pacing, the
 * latest transactions and how net worth has moved. Net worth is computed
 * from current account balances, per domain.md, never stored, with card
 * debt counted against it.
 */
export class GetDashboardSummaryUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly budgetRepository: BudgetRepository,
    private readonly recurringTransactionRepository: RecurringTransactionRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRuleRepository: MerchantRuleRepository,
  ) {}

  async execute(userId: string): Promise<DashboardSummary> {
    const now = new Date();
    const rangeStart = new Date(
      now.getFullYear(),
      now.getMonth() - (TREND_MONTHS - 1),
      1,
    );

    const [
      accounts,
      transactionsInRange,
      futureTransactions,
      latest,
      budgetProgress,
      recurringRules,
      categories,
      merchantRules,
    ] = await Promise.all([
      this.accountRepository.findByUserId(userId),
      this.transactionRepository.findByUserId(userId, {
        from: rangeStart,
        to: now,
        pageSize: 10_000,
      }),
      this.transactionRepository.findByUserId(userId, {
        from: daysBefore(now, -1),
        pageSize: 10_000,
      }),
      // Not limited to the range above: a quiet half-year still shows the
      // last things that happened.
      this.transactionRepository.findByUserId(userId, {
        to: now,
        pageSize: RECENT_COUNT * 4,
      }),
      new GetBudgetProgressUseCase(
        this.budgetRepository,
        this.transactionRepository,
      ).execute(userId, now),
      this.recurringTransactionRepository.findByUserId(userId),
      this.categoryRepository.findByUserId(userId),
      this.merchantRuleRepository.findByUserId(userId),
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

    const visibleBalances = accountBalances.filter(
      ({ account }) => !account.hidden,
    );
    const visibleIds = new Set(
      visibleBalances.map(({ account }) => account.id),
    );
    const onVisibleAccount = (transaction: Transaction) =>
      visibleIds.has(transaction.accountId);

    const netWorth = visibleBalances.reduce(
      (sum, { account, currentBalance }) =>
        sum + netWorthContribution(account, currentBalance),
      0,
    );
    const owedOnCards = visibleBalances
      .filter(({ account }) => account.type === 'credit')
      .reduce(
        (sum, { currentBalance }) => sum + Math.max(0, currentBalance),
        0,
      );
    const projectedNetWorth = visibleBalances.reduce(
      (sum, { account, projectedBalance }) =>
        sum + netWorthContribution(account, projectedBalance),
      0,
    );

    const cardStatements = calculateCardStatements(
      accountBalances,
      transactionsInRange,
      now,
    );

    const reviewFrom = daysBefore(now, REVIEW_DAYS);
    const toReview = transactionsInRange
      .filter(
        (transaction) =>
          onVisibleAccount(transaction) &&
          !transaction.categoryId &&
          transaction.occurredAt >= reviewFrom &&
          (transaction.countsAs('expense') || transaction.countsAs('income')),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    const recent = latest.filter(onVisibleAccount).slice(0, RECENT_COUNT);

    const historyFrom = daysBefore(now, SUGGESTION_HISTORY_DAYS);
    const history = transactionsInRange.filter(
      (transaction) => transaction.occurredAt >= historyFrom,
    );
    const selectableCategoryIds = categories
      .filter((category) => !category.archived)
      .map((category) => category.id);
    const suggest = createCategorySuggester({
      categoryIds: selectableCategoryIds,
      rules: merchantRules,
      history: history.filter((transaction) => transaction.categoryId),
    });
    const entryAccounts = quickEntryAccounts(accounts, history);
    const shown = [...toReview.slice(0, REVIEW_VISIBLE), ...recent];
    const categorySuggestions: Record<string, string[]> = {};
    for (const transaction of shown) {
      if (transaction.categoryId || !transaction.takesCategory) continue;
      categorySuggestions[transaction.id] = suggest(
        transaction.description,
        transaction.type,
      );
    }

    return {
      netWorth,
      projectedNetWorth,
      netWorthTrend: calculateNetWorthByMonth(
        accounts,
        [...transactionsInRange, ...futureTransactions],
        { from: rangeStart, to: now },
        now,
      ),
      owedOnCards,
      accounts,
      accountBalances,
      futureTransactions,
      categories,
      toReview,
      categorySuggestions,
      newCategorySuggestions: suggestNewCategories({
        transactions: shown,
        categories,
        rules: merchantRules,
      }),
      budgetPace: calculateBudgetPace(budgetProgress, now),
      recentDays: groupRecentByDay(
        recent,
        transactionsInRange.filter(onVisibleAccount),
      ),
      availableToSpend: calculateAvailableToSpend({
        balances: accountBalances,
        recurringRules,
        futureTransactions,
        today: now,
      }),
      monthToDate: calculateMonthToDate(transactionsInRange, now),
      cardStatements,
      upcoming: calculateUpcoming({
        balances: accountBalances,
        recurringRules,
        futureTransactions,
        cardStatements,
        today: now,
      }),
      quickEntry: {
        accounts: entryAccounts,
        merchants: buildMerchantMemory({
          rules: merchantRules,
          history,
          categoryIds: selectableCategoryIds,
          accountIds: entryAccounts.map((account) => account.id),
        }),
      },
    };
  }
}
