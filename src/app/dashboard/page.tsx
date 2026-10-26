import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Section, SectionHeader, SectionLink } from '@/components/ui/section';
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
import { splitOrigin } from '@/shared/lib/transaction-origin';

import { AvailableHero } from './available-hero';
import { BudgetPaceList } from './budget-pace';
import { CardStatements } from './card-statements';
import type { CategoryOption } from './category-picker';
import { NetWorthTrend } from './net-worth-trend';
import { QuickEntry } from './quick-entry';
import { type RecentDayView, RecentTransactions } from './recent-transactions';
import { ReviewQueue } from './review-queue';
import { UpcomingList } from './upcoming-list';

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
        <h1 className="sr-only">Início</h1>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden opacity-25"
        >
          <div className="sheet-surface p-6">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-10 w-64" />
            <Skeleton className="mt-8 h-2 w-full" />
          </div>
        </div>
        <div className="relative flex items-center justify-center py-12">
          <EmptyState
            title="Nenhuma conta cadastrada."
            description="Crie sua primeira conta para começar a acompanhar suas finanças."
            action={
              <Link href={ROUTES.accounts} className={buttonVariants()}>
                Criar primeira conta
              </Link>
            }
          />
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
        newCategory: summary.newCategorySuggestions[transaction.id],
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
      newCategory: summary.newCategorySuggestions[transaction.id],
    })),
  }));

  const categoryNames = new Map(
    summary.categories.map((category) => [category.id, category.name]),
  );
  const hasCards = summary.cardStatements.length > 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <h1 className="sr-only">Início</h1>

      <QuickEntry
        accounts={summary.quickEntry.accounts}
        categories={selectable}
        merchants={summary.quickEntry.merchants}
      />

      {/* The one card on this screen: how much is still free to spend until
          the next income, with the month so far and net worth beside it. */}
      <Card className="p-5 sm:p-6">
        <AvailableHero
          available={summary.availableToSpend}
          owedOnCards={summary.owedOnCards}
          monthToDate={summary.monthToDate}
          netWorth={summary.netWorth}
          projectedNetWorth={summary.projectedNetWorth}
        />
      </Card>

      {/* A main column (how it's going, what happened) and a narrower one
          for what asks for attention, divided by hairlines instead of boxed.
          On a phone both columns dissolve (display: contents) and `order`
          interleaves them: what needs action first, then the record. */}
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="contents lg:flex lg:flex-col lg:gap-8">
          <div className="order-3 lg:order-none">
            <NetWorthTrend points={summary.netWorthTrend} />
          </div>

          <Section className="order-4 lg:order-none">
            <SectionHeader
              title="Últimas transações"
              action={
                <SectionLink href={ROUTES.transactions}>Ver todas</SectionLink>
              }
            />
            {recentDays.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhuma transação registrada.{' '}
                <Link
                  href={ROUTES.transactions}
                  className="text-foreground underline underline-offset-4"
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
          </Section>
        </div>

        <div className="lg:divide-border contents lg:flex lg:flex-col lg:divide-y lg:[&>*]:py-7 lg:[&>*:first-child]:pt-0 lg:[&>*:last-child]:pb-0">
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
          <div className="order-5 lg:order-none">
            <BudgetPaceList
              paces={summary.budgetPace}
              categoryNames={categoryNames}
            />
          </div>
          <div className="order-6 lg:order-none">
            <UpcomingList upcoming={summary.upcoming} today={today} />
          </div>
        </div>
      </div>
    </div>
  );
}
