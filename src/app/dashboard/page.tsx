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
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/get-dashboard-summary.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatMonthLabel, formatOccurredAt } from '@/shared/lib/format-date';
import { getCategoryOptions } from '@/shared/server/reference-options';

import { AvailableHero } from './available-hero';
import { CardStatements } from './card-statements';
import { UpcomingList } from './upcoming-list';

export default async function DashboardPage() {
  const userId = await requireCurrentUserId();

  const useCase = new GetDashboardSummaryUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    new DrizzleRecurringTransactionRepository(),
  );
  const [summary, categories] = await Promise.all([
    useCase.execute(userId),
    getCategoryOptions(userId),
  ]);
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  if (summary.accounts.length === 0) {
    return (
      <AppShell>
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
      </AppShell>
    );
  }

  const maxFlow = Math.max(
    1,
    ...summary.cashFlow.map((m) => Math.max(m.income, m.expense)),
  );
  const today = new Date();

  return (
    <AppShell>
      <div className="space-y-6">
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

        <section
          className={
            summary.cardStatements.length > 0
              ? 'grid grid-cols-1 items-start gap-4 lg:grid-cols-2'
              : undefined
          }
        >
          {summary.cardStatements.length > 0 && (
            <CardStatements
              statements={summary.cardStatements}
              payingAccounts={summary.accounts
                .filter(
                  (account) => account.type !== 'credit' && !account.archived,
                )
                .map((account) => ({ id: account.id, name: account.name }))}
              today={today}
            />
          )}
          <UpcomingList upcoming={summary.upcoming} today={today} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Fluxo de caixa</CardTitle>
              <CardDescription>
                Receitas e despesas nos últimos {summary.cashFlow.length} meses.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-6 p-0">
              <div className="bg-muted/50 flex h-56 items-end gap-3 rounded-md p-4">
                {summary.cashFlow.map((month) => {
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
                  const toDateParam = (date: Date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                  };
                  const linkEnd = monthEnd > today ? today : monthEnd;

                  return (
                    <div
                      key={month.month.toISOString()}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="flex h-40 w-full items-end gap-1">
                        <Link
                          href={`${ROUTES.transactions}?from=${toDateParam(monthStart)}&to=${toDateParam(linkEnd)}&type=income`}
                          className="bg-success hover:bg-success/80 focus-visible:ring-ring flex-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          style={{
                            height: `${(month.income / maxFlow) * 100}%`,
                          }}
                          title={`Receitas: ${formatCurrency(month.income)} — clique para ver as transações`}
                          aria-label={`Ver receitas de ${formatMonthLabel(month.month)}: ${formatCurrency(month.income)}`}
                        />
                        <Link
                          href={`${ROUTES.transactions}?from=${toDateParam(monthStart)}&to=${toDateParam(linkEnd)}&type=expense`}
                          className="bg-destructive hover:bg-destructive/80 focus-visible:ring-ring flex-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          style={{
                            height: `${(month.expense / maxFlow) * 100}%`,
                          }}
                          title={`Despesas: ${formatCurrency(month.expense)} — clique para ver as transações`}
                          aria-label={`Ver despesas de ${formatMonthLabel(month.month)}: ${formatCurrency(month.expense)}`}
                        />
                      </div>
                      <span className="font-display text-muted-foreground text-xs capitalize">
                        {formatMonthLabel(month.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="bg-success inline-block h-2 w-2" /> Receitas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-destructive inline-block h-2 w-2" />{' '}
                  Despesas
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Orçamentos</CardTitle>
              <CardDescription>Consumo do período atual.</CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              {summary.budgets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhum orçamento cadastrado.{' '}
                  <Link
                    href={ROUTES.budgets}
                    className="text-foreground underline"
                  >
                    Criar orçamento
                  </Link>
                </p>
              ) : (
                summary.budgets
                  .slice(0, 4)
                  .map(({ budget, spent, percentage }) => (
                    <div key={budget.id} className="dimension-row block">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium">
                          {categoryNames.get(budget.categoryId) ??
                            'Categoria removida'}
                        </span>
                        <span className="text-muted-foreground dimension-figure">
                          {Math.round(percentage * 100)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground dimension-figure mt-0.5 mb-2 text-xs">
                        {formatCurrency(spent, budget.currency)} de{' '}
                        {formatCurrency(budget.amount, budget.currency)}
                      </p>
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
                  ))
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle>Últimas transações</CardTitle>
              <CardDescription>Movimentações mais recentes.</CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              {summary.recentTransactions.length === 0 ? (
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
                summary.recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="dimension-row">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatOccurredAt(transaction.occurredAt)}
                      </p>
                    </div>
                    <p
                      className={`dimension-figure font-semibold whitespace-nowrap ${
                        transaction.type === 'income'
                          ? 'text-success'
                          : transaction.type === 'expense'
                            ? 'text-destructive'
                            : 'text-foreground'
                      }`}
                    >
                      {transaction.type === 'income'
                        ? '+ '
                        : transaction.type === 'expense'
                          ? '− '
                          : '⇄ '}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
