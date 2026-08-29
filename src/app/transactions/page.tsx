import Link from 'next/link';

import { CreateTransferDialog } from '@/app/transactions/create-transfer-dialog';
import { FilterChips } from '@/app/transactions/filter-chips';
import { ImportDialog } from '@/app/transactions/import-dialog';
import { RecurringTransactionFormDialog } from '@/app/transactions/recurring-transaction-form-dialog';
import { RecurringTransactionRow } from '@/app/transactions/recurring-transaction-row';
import { TransactionList } from '@/app/transactions/transaction-list';
import { TransactionsFilters } from '@/app/transactions/transactions-filters';
import { ViewModeSelector } from '@/app/transactions/view-mode-selector';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TRANSACTION_VIEW_MODES,
  type TransactionViewMode,
} from '@/config/constants';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { DrizzleViewPreferenceRepository } from '@/infra/repositories/drizzle-view-preference.repository';
import { GetInstallmentPlansUseCase } from '@/modules/installments/application/get-installment-plans.use-case';
import { GetViewPreferenceUseCase } from '@/modules/preferences/application/get-view-preference.use-case';
import { GetRecurringTransactionsUseCase } from '@/modules/recurring-transactions/application/get-recurring-transactions.use-case';
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';
import { encodeTransactionCursor } from '@/shared/lib/transaction-cursor';

/** Defends against a stored view-preference value written by a future
 * version of the app with a mode this version doesn't know, or genuinely
 * corrupted data — falls back to the default rather than trusting an
 * unsafe cast. */
function isTransactionViewMode(value: string): value is TransactionViewMode {
  return (TRANSACTION_VIEW_MODES as readonly string[]).includes(value);
}

interface TransactionsPageProps {
  searchParams: Promise<{
    accountId?: string;
    categoryId?: string;
    type?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const userId = await requireCurrentUserId();
  const filters = await searchParams;

  const [
    accounts,
    categories,
    installmentPlans,
    recurringTransactions,
    rawViewMode,
  ] = await Promise.all([
    new DrizzleAccountRepository().findByUserId(userId),
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetInstallmentPlansUseCase(
      new DrizzleInstallmentPlanRepository(),
    ).execute(userId),
    new GetRecurringTransactionsUseCase(
      new DrizzleRecurringTransactionRepository(),
    ).execute(userId),
    new GetViewPreferenceUseCase(new DrizzleViewPreferenceRepository()).execute(
      userId,
      'transactions',
      'chronological',
    ),
  ]);
  const viewMode = isTransactionViewMode(rawViewMode)
    ? rawViewMode
    : 'chronological';

  // Fetch one extra row to know whether a next page exists, without a
  // separate COUNT query — a simple, cheap cursor-pagination pattern.
  const from = filters.from ? new Date(`${filters.from}T00:00:00`) : undefined;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`) : undefined;

  const TRANSACTIONS_PAGE_SIZE = 50;
  const rawPage = await new GetTransactionsUseCase(
    new DrizzleTransactionRepository(),
  ).execute(userId, {
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    type:
      (filters.type as 'income' | 'expense' | 'transfer' | undefined) ||
      undefined,
    from,
    to,
    pageSize: TRANSACTIONS_PAGE_SIZE + 1,
  });
  const hasMore = rawPage.length > TRANSACTIONS_PAGE_SIZE;
  const transactions = rawPage.slice(0, TRANSACTIONS_PAGE_SIZE);
  const lastTransaction = transactions.at(-1);
  const nextCursor =
    hasMore && lastTransaction
      ? encodeTransactionCursor({
          occurredAt: lastTransaction.occurredAt,
          id: lastTransaction.id,
        })
      : null;

  const filterParams = new URLSearchParams();
  if (filters.accountId) filterParams.set('accountId', filters.accountId);
  if (filters.categoryId) filterParams.set('categoryId', filters.categoryId);
  if (filters.type) filterParams.set('type', filters.type);
  if (filters.from) filterParams.set('from', filters.from);
  if (filters.to) filterParams.set('to', filters.to);

  const accountsById = new Map(
    accounts.map((account) => [account.id, account]),
  );
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  // Plain object, not a Map — Map instances aren't serializable across the
  // React Server Components boundary and throw a runtime error when passed
  // as a prop into a 'use client' component like TransactionList.
  const installmentCountByPlanId: Record<string, number> = Object.fromEntries(
    installmentPlans.map((plan) => [plan.id, plan.installmentCount]),
  );

  // Client Components can only receive plain objects — entity class
  // instances aren't serializable across the server/client boundary.
  const accountOptions = accounts.map((account) => ({
    id: account.id,
    name: account.name,
  }));
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <TransactionsFilters
              accounts={accountOptions}
              categories={categoryOptions}
              defaultAccountId={filters.accountId}
              defaultCategoryId={filters.categoryId}
              defaultType={filters.type}
              defaultFrom={filters.from}
              defaultTo={filters.to}
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              <ViewModeSelector value={viewMode} />
              {accountOptions.length >= 2 ? (
                <CreateTransferDialog accounts={accountOptions} />
              ) : null}
              <Button variant="outline" asChild>
                <Link
                  href={`/api/transactions/export?${filterParams.toString()}`}
                >
                  Exportar
                </Link>
              </Button>
              <ImportDialog />
            </div>
          </div>

          <FilterChips
            accounts={accountOptions}
            categories={categoryOptions}
            filters={{
              accountId: filters.accountId,
              categoryId: filters.categoryId,
              type: filters.type,
              from: filters.from,
              to: filters.to,
            }}
          />

          <Card className="overflow-hidden p-0">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <CardTitle>Nenhuma transação encontrada.</CardTitle>
                <CardDescription>
                  Registre sua primeira transação pelo botão &quot;Nova
                  transação&quot; no topo da página.
                </CardDescription>
              </div>
            ) : (
              <TransactionList
                initial={{
                  transactions: transactions.map((transaction) => ({
                    id: transaction.id,
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                    occurredAt: transaction.occurredAt.toISOString(),
                    accountId: transaction.accountId,
                    accountName:
                      accountsById.get(transaction.accountId)?.name ?? '—',
                    categoryId: transaction.categoryId ?? null,
                    categoryName: transaction.categoryId
                      ? (categoriesById.get(transaction.categoryId)?.name ??
                        null)
                      : null,
                    installmentPlanId: transaction.installmentPlanId ?? null,
                    installmentNumber: transaction.installmentNumber ?? null,
                    recurringRuleId: transaction.recurringRuleId ?? null,
                  })),
                  nextCursor,
                }}
                filters={{
                  accountId: filters.accountId,
                  categoryId: filters.categoryId,
                  type: filters.type,
                  from: filters.from,
                  to: filters.to,
                }}
                categories={categoryOptions}
                installmentCountByPlanId={installmentCountByPlanId}
                groupBy={viewMode}
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Recorrências</CardTitle>
              <CardDescription>
                Receitas e despesas que se repetem todo mês.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 space-y-4 p-0">
              {accounts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Crie uma conta antes de configurar uma recorrência.
                </p>
              ) : (
                <>
                  {recurringTransactions.length > 0 && (
                    <div className="divide-border/70 -mx-1 divide-y">
                      {recurringTransactions.map((rule) => (
                        <div
                          key={rule.id}
                          className="px-1 py-2 first:pt-0 last:pb-0"
                        >
                          <RecurringTransactionRow
                            id={rule.id}
                            description={rule.description}
                            amount={rule.amount}
                            type={rule.type}
                            dayRuleKind={rule.dayRuleKind}
                            dayRuleDay={rule.dayRuleDay}
                            active={rule.active}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <RecurringTransactionFormDialog
                    accounts={accountOptions}
                    categories={categoryOptions}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
