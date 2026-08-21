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
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetDashboardSummaryUseCase } from '@/modules/dashboard/application/get-dashboard-summary.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import {
  formatDate,
  formatDateTime,
  formatMonthLabel,
} from '@/shared/lib/format-date';

export default async function DashboardPage() {
  const userId = await requireCurrentUserId();

  const useCase = new GetDashboardSummaryUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
  );
  const summary = await useCase.execute(userId);

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

  const netFlow = summary.monthIncome - summary.monthExpense;
  const subStats = [
    {
      label: 'Receitas do mês',
      value: summary.monthIncome,
      tone: 'success' as const,
    },
    {
      label: 'Despesas do mês',
      value: summary.monthExpense,
      tone: 'error' as const,
    },
    {
      label: 'Fluxo de caixa',
      value: netFlow,
      tone: netFlow >= 0 ? ('success' as const) : ('error' as const),
    },
  ];

  const maxFlow = Math.max(
    1,
    ...summary.cashFlow.map((m) => Math.max(m.income, m.expense)),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero — the ledger's opening line: today's balance, dated like an
            actual page in a ledger book. */}
        <Card className="ledger-spine p-6 sm:p-8">
          <p className="font-display text-muted-foreground text-sm italic">
            Patrimônio · {formatDate(new Date())}
          </p>
          <p className="ledger-figure mt-2 text-4xl font-semibold sm:text-5xl">
            {formatCurrency(summary.netWorth)}
          </p>

          {(() => {
            const projectedTotal = summary.accountBalances
              .filter(({ account }) => !account.hidden)
              .reduce((sum, { projectedBalance }) => sum + projectedBalance, 0);
            const difference = projectedTotal - summary.netWorth;

            if (Math.abs(difference) < 0.005) return null;

            return (
              <p className="text-muted-foreground mt-1 text-sm">
                Projetado (com compromissos futuros):{' '}
                <span className="ledger-figure font-medium">
                  {formatCurrency(projectedTotal)}
                </span>
              </p>
            );
          })()}

          <div className="border-border mt-6 grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3">
            {subStats.map((stat) => (
              <div key={stat.label}>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p
                  className={`ledger-figure mt-1 text-xl font-semibold ${
                    stat.tone === 'success'
                      ? 'text-success'
                      : 'text-destructive'
                  }`}
                >
                  {formatCurrency(stat.value)}
                </p>
              </div>
            ))}
          </div>

          {(() => {
            const futureExpenses = summary.futureTransactions.filter(
              (t) => t.type === 'expense',
            );
            return (
              futureExpenses.length > 0 && (
                <div className="border-border mt-4 border-t pt-4">
                  <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                    Compromissos futuros
                  </p>
                  <ul className="space-y-1">
                    {Object.entries(
                      futureExpenses.reduce<Record<string, number>>(
                        (groups, t) => {
                          const label = t.description.replace(
                            /\s*\(\d+\/\d+\)$/,
                            '',
                          );
                          groups[label] = (groups[label] ?? 0) + t.amount;
                          return groups;
                        },
                        {},
                      ),
                    )
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([label, total]) => (
                        <li
                          key={label}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-muted-foreground">{label}</span>
                          <span className="ledger-figure">
                            {formatCurrency(total)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )
            );
          })()}
        </Card>

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

                  return (
                    <div
                      key={month.month.toISOString()}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="flex h-40 w-full items-end gap-1">
                        <Link
                          href={`${ROUTES.transactions}?from=${toDateParam(monthStart)}&to=${toDateParam(monthEnd)}&type=income`}
                          className="bg-success hover:bg-success/80 focus-visible:ring-ring flex-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          style={{
                            height: `${(month.income / maxFlow) * 100}%`,
                          }}
                          title={`Receitas: ${formatCurrency(month.income)} — clique para ver as transações`}
                          aria-label={`Ver receitas de ${formatMonthLabel(month.month)}: ${formatCurrency(month.income)}`}
                        />
                        <Link
                          href={`${ROUTES.transactions}?from=${toDateParam(monthStart)}&to=${toDateParam(monthEnd)}&type=expense`}
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
                  (tinta preta)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-destructive inline-block h-2 w-2" />{' '}
                  Despesas (tinta vermelha)
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
                summary.budgets.slice(0, 4).map(({ budget, percentage }) => (
                  <div key={budget.id} className="ledger-row block">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="ledger-figure">
                        {formatCurrency(budget.amount, budget.currency)}
                      </span>
                      <span className="text-muted-foreground ledger-figure">
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
                  <div key={transaction.id} className="ledger-row">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatDateTime(transaction.occurredAt)}
                      </p>
                    </div>
                    <p
                      className={`ledger-figure font-semibold ${
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
                          ? '- '
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
