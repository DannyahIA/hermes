import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import type { Transaction } from '@/core/entities/transaction';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import {
  GetDashboardSummaryUseCase,
  REVIEW_VISIBLE,
} from '@/modules/dashboard/application/get-dashboard-summary.use-case';
import { formatDayLabel, formatTimeOfDay } from '@/shared/lib/format-date';
import { toDateInput } from '@/shared/lib/local-day';
import { UNCATEGORIZED_FILTER } from '@/shared/lib/transaction-filters';

import { AvailableHero } from './available-hero';
import { BudgetPaceList } from './budget-pace';
import { CardStatements } from './card-statements';
import type { CategoryOption } from './category-picker';
import { NetWorthTrend } from './net-worth-trend';
import { QuickEntry } from './quick-entry';
import { type RecentDayView, RecentTransactions } from './recent-transactions';
import { ReviewQueue } from './review-queue';
import { UpcomingList } from './upcoming-list';

const INSTALLMENT_SUFFIX = /\s*\((\d+\/\d+)\)\s*$/;

/** "Geladeira (4/10)" reads as "Geladeira" with the mark "Parcela 4/10". */
function splitOrigin(transaction: Transaction): {
  description: string;
  origin?: string;
} {
  const installment = transaction.installmentPlanId
    ? INSTALLMENT_SUFFIX.exec(transaction.description)
    : null;
  if (installment) {
    return {
      description: transaction.description.slice(0, installment.index),
      origin: `Parcela ${installment[1]}`,
    };
  }
  return {
    description: transaction.description,
    origin: transaction.recurringRuleId ? 'Recorrente' : undefined,
  };
}

/**
 * No `loading.tsx` and no Suspense boundary around the content, on purpose:
 * on Next 16.2.10, with either one here, the re-render a Server Action sends
 * back (revalidatePath) — or a `router.refresh()` — never commits. The
 * transition stays pending and the page keeps its old data until a reload,
 * so "Para revisar" and "Pagar fatura" would look broken.
 */
export default async function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}

async function DashboardContent() {
  const userId = await requireCurrentUserId();

  const summary = await new GetDashboardSummaryUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    new DrizzleRecurringTransactionRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleMerchantRuleRepository(),
  ).execute(userId);

  if (summary.accounts.length === 0) {
    return (
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 space-y-6 overflow-hidden opacity-20 blur-[1px]"
        >
          <div className="registration-frame rounded-xl border p-6 sm:p-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-12 w-64" />
            <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-center py-12">
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
    );
  }

  const today = new Date();
  const accountNames = new Map(
    summary.accounts.map((account) => [account.id, account.name]),
  );
  const categoriesById: Record<string, CategoryOption> = {};
  for (const category of summary.categories) {
    categoriesById[category.id] = {
      id: category.id,
      name: category.name,
      color: category.color,
    };
  }
  const selectable = summary.categories
    .filter((category) => !category.archived)
    .map((category) => categoriesById[category.id])
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const suggestionsFor = (transaction: Transaction) =>
    (summary.categorySuggestions[transaction.id] ?? []).map(
      (id) => categoriesById[id],
    );

  const reviewItems = summary.toReview
    .slice(0, REVIEW_VISIBLE)
    .map((transaction) => {
      const time = formatTimeOfDay(transaction.occurredAt);
      return {
        id: transaction.id,
        description: transaction.description,
        amount: transaction.amount,
        type: transaction.type as 'income' | 'expense',
        when: `${formatDayLabel(transaction.occurredAt, today)}${time ? ` às ${time}` : ''}`,
        accountName: accountNames.get(transaction.accountId) ?? '',
        suggestions: suggestionsFor(transaction),
      };
    });
  const reviewFrom = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 30,
  );

  const recentDays: RecentDayView[] = summary.recentDays.map((day) => ({
    key: day.date.toISOString(),
    label: formatDayLabel(day.date, today),
    net: day.net,
    rows: day.transactions.map((transaction) => ({
      id: transaction.id,
      ...splitOrigin(transaction),
      categoryId: transaction.categoryId,
      accountName: accountNames.get(transaction.accountId) ?? '',
      time: formatTimeOfDay(transaction.occurredAt),
      amount: transaction.amount,
      type: transaction.type,
      settles: transaction.settlesAccountId
        ? (accountNames.get(transaction.settlesAccountId) ?? 'do cartão')
        : undefined,
      suggestions: suggestionsFor(transaction),
    })),
  }));

  const categoryNames = new Map(
    summary.categories.map((category) => [category.id, category.name]),
  );
  const hasCards = summary.cardStatements.length > 0;

  return (
    <div className="space-y-4 lg:space-y-6">
      <QuickEntry
        accounts={summary.quickEntry.accounts}
        categories={selectable}
        merchants={summary.quickEntry.merchants}
      />

      {/* Hero — how much is still free to spend until the next income,
            with the month so far and net worth beside it. */}
      <Card className="registration-frame p-6 sm:p-8">
        <AvailableHero
          available={summary.availableToSpend}
          owedOnCards={summary.owedOnCards}
          monthToDate={summary.monthToDate}
          netWorth={summary.netWorth}
          projectedNetWorth={summary.projectedNetWorth}
        />
      </Card>

      {/* Two independent columns on a wide screen, so a tall card on one
            side never leaves a gap on the other. On a phone the columns
            dissolve (display: contents) and `order` interleaves them in the
            order of the questions: review, cards, budgets, what's next. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          {summary.toReview.length > 0 && (
            <div className="order-1 lg:order-none">
              <ReviewQueue
                items={reviewItems}
                total={summary.toReview.length}
                categories={selectable}
                seeAllHref={`${ROUTES.transactions}?categoryId=${UNCATEGORIZED_FILTER}&from=${toDateInput(reviewFrom)}`}
              />
            </div>
          )}
          <div className="order-3 lg:order-none">
            <BudgetPaceList
              paces={summary.budgetPace}
              categoryNames={categoryNames}
            />
          </div>
        </div>
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          {hasCards && (
            <div className="order-2 lg:order-none">
              <CardStatements
                statements={summary.cardStatements}
                payingAccounts={summary.accounts
                  .filter(
                    (account) => account.type !== 'credit' && !account.archived,
                  )
                  .map((account) => ({ id: account.id, name: account.name }))}
                today={today}
              />
            </div>
          )}
          <div className="order-4 lg:order-none">
            <UpcomingList upcoming={summary.upcoming} today={today} />
          </div>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader className="flex-row items-baseline justify-between gap-3 space-y-0 p-0">
          <CardTitle className="text-xl">Últimas transações</CardTitle>
          <Link
            href={ROUTES.transactions}
            className="text-muted-foreground hover:text-foreground shrink-0 text-sm underline-offset-4 hover:underline"
          >
            Ver todas
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentDays.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhuma transação registrada.{' '}
              <Link
                href={ROUTES.transactions}
                className="text-foreground underline"
              >
                Registrar transação
              </Link>
            </p>
          ) : (
            <RecentTransactions
              days={recentDays}
              categoriesById={categoriesById}
              categories={selectable}
            />
          )}
        </CardContent>
      </Card>

      <NetWorthTrend points={summary.netWorthTrend} />
    </div>
  );
}
