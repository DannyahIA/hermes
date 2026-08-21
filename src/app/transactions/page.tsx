import Link from 'next/link';

import { ImportDialog } from '@/app/transactions/import-dialog';
import { RecurringTransactionFormDialog } from '@/app/transactions/recurring-transaction-form-dialog';
import { RecurringTransactionRow } from '@/app/transactions/recurring-transaction-row';
import { TransactionForm } from '@/app/transactions/transaction-form';
import { TransactionRow } from '@/app/transactions/transaction-row';
import { TransactionRowMobile } from '@/app/transactions/transaction-row-mobile';
import { TransactionsFilters } from '@/app/transactions/transactions-filters';
import { TransferForm } from '@/app/transactions/transfer-form';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PAGE_SIZE } from '@/config/constants';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleInstallmentPlanRepository } from '@/infra/repositories/drizzle-installment-plan.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetAccountsUseCase } from '@/modules/accounts/application/get-accounts.use-case';
import { GetInstallmentPlansUseCase } from '@/modules/installments/application/get-installment-plans.use-case';
import { GetRecurringTransactionsUseCase } from '@/modules/recurring-transactions/application/get-recurring-transactions.use-case';
import { GetTransactionsUseCase } from '@/modules/transactions/application/get-transactions.use-case';

interface TransactionsPageProps {
  searchParams: Promise<{
    accountId?: string;
    categoryId?: string;
    type?: string;
    from?: string;
    to?: string;
    limit?: string;
  }>;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const userId = await requireCurrentUserId();
  const filters = await searchParams;

  const limit = Math.max(PAGE_SIZE, Number(filters.limit) || PAGE_SIZE);

  const [accounts, categories, installmentPlans, recurringTransactions] =
    await Promise.all([
      new GetAccountsUseCase(new DrizzleAccountRepository()).execute(userId),
      new DrizzleCategoryRepository().findByUserId(userId),
      new GetInstallmentPlansUseCase(
        new DrizzleInstallmentPlanRepository(),
      ).execute(userId),
      new GetRecurringTransactionsUseCase(
        new DrizzleRecurringTransactionRepository(),
      ).execute(userId),
    ]);

  // Fetch one extra row to know whether a next page exists, without a
  // separate COUNT query — a simple, cheap "load more" pattern.
  const from = filters.from ? new Date(`${filters.from}T00:00:00`) : undefined;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`) : undefined;

  const page = await new GetTransactionsUseCase(
    new DrizzleTransactionRepository(),
  ).execute(userId, {
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    type:
      (filters.type as 'income' | 'expense' | 'transfer' | undefined) ||
      undefined,
    from,
    to,
    pageSize: limit + 1,
  });
  const hasMore = page.length > limit;
  const transactions = page.slice(0, limit);

  const filterParams = new URLSearchParams();
  if (filters.accountId) filterParams.set('accountId', filters.accountId);
  if (filters.categoryId) filterParams.set('categoryId', filters.categoryId);
  if (filters.type) filterParams.set('type', filters.type);
  if (filters.from) filterParams.set('from', filters.from);
  if (filters.to) filterParams.set('to', filters.to);

  const loadMoreParams = new URLSearchParams(filterParams);
  loadMoreParams.set('limit', String(limit + PAGE_SIZE));

  const accountsById = new Map(
    accounts.map((account) => [account.id, account]),
  );
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const installmentCountByPlanId = new Map(
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
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <TransactionsFilters
              accounts={accounts}
              categories={categories}
              defaultAccountId={filters.accountId}
              defaultCategoryId={filters.categoryId}
              defaultType={filters.type}
              defaultFrom={filters.from}
              defaultTo={filters.to}
            />
            <div className="flex shrink-0 gap-2">
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

          <Card className="overflow-hidden p-0">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-12 text-center">
                <CardTitle>Nenhuma transação encontrada.</CardTitle>
                <CardDescription>
                  Registre sua primeira transação usando o formulário ao lado.
                </CardDescription>
              </div>
            ) : (
              <>
                {/* Mobile: stacked ledger rows. Desktop: the full table. */}
                <div className="divide-border/70 px-4 sm:hidden">
                  {transactions.map((transaction) => (
                    <TransactionRowMobile
                      key={transaction.id}
                      id={transaction.id}
                      description={transaction.description}
                      amount={transaction.amount}
                      type={transaction.type}
                      occurredAt={transaction.occurredAt}
                      accountName={
                        accountsById.get(transaction.accountId)?.name ?? '—'
                      }
                      categoryId={transaction.categoryId}
                      categoryName={
                        transaction.categoryId
                          ? categoriesById.get(transaction.categoryId)?.name
                          : undefined
                      }
                      categories={categoryOptions}
                      installmentLabel={
                        transaction.installmentPlanId &&
                        transaction.installmentNumber
                          ? `${transaction.installmentNumber}/${installmentCountByPlanId.get(transaction.installmentPlanId) ?? '?'}`
                          : undefined
                      }
                      isRecurring={Boolean(transaction.recurringRuleId)}
                    />
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full text-left">
                    <thead className="border-border/70 border-b">
                      <tr className="text-muted-foreground text-xs uppercase">
                        <th className="px-4 py-3 font-medium">Data</th>
                        <th className="px-4 py-3 font-medium">Descrição</th>
                        <th className="px-4 py-3 font-medium">Conta</th>
                        <th className="px-4 py-3 font-medium">Categoria</th>
                        <th className="px-4 py-3 font-medium">Tipo</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Valor
                        </th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <TransactionRow
                          key={transaction.id}
                          id={transaction.id}
                          description={transaction.description}
                          amount={transaction.amount}
                          type={transaction.type}
                          occurredAt={transaction.occurredAt}
                          accountName={
                            accountsById.get(transaction.accountId)?.name ?? '—'
                          }
                          categoryId={transaction.categoryId}
                          categoryName={
                            transaction.categoryId
                              ? categoriesById.get(transaction.categoryId)?.name
                              : undefined
                          }
                          categories={categoryOptions}
                          installmentLabel={
                            transaction.installmentPlanId &&
                            transaction.installmentNumber
                              ? `${transaction.installmentNumber}/${installmentCountByPlanId.get(transaction.installmentPlanId) ?? '?'}`
                              : undefined
                          }
                          isRecurring={Boolean(transaction.recurringRuleId)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" asChild>
                <Link href={`?${loadMoreParams.toString()}`}>
                  Carregar mais
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Nova transação</CardTitle>
              <CardDescription>
                Registre uma receita ou despesa.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              {accounts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Crie uma conta antes de registrar transações.
                </p>
              ) : (
                <TransactionForm
                  accounts={accountOptions}
                  categories={categoryOptions}
                />
              )}
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Transferência</CardTitle>
              <CardDescription>
                Mova dinheiro entre suas contas.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              <TransferForm accounts={accountOptions} />
            </CardContent>
          </Card>

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
