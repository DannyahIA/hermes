import Link from 'next/link';

import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/config/routes';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetSpendingReportUseCase } from '@/modules/reports/application/get-spending-report.use-case';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate, formatMonthLabel } from '@/shared/lib/format-date';

const DEFAULT_PERIOD_MONTHS = 6;

interface ReportsPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function defaultPeriod(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(
    now.getFullYear(),
    now.getMonth() - (DEFAULT_PERIOD_MONTHS - 1),
    1,
  );
  return { from, to: now };
}

/** Matches the `toISOString().slice(0, 10)` convention already used by the
 * transaction forms for a `<input type="date">` default value. */
function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;

  const defaults = defaultPeriod();
  const from = params.from
    ? new Date(`${params.from}T00:00:00`)
    : defaults.from;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : defaults.to;

  const report = await new GetSpendingReportUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleRecurringTransactionRepository(),
  ).execute(userId, { from, to });

  const maxFlow = Math.max(
    1,
    ...report.cashFlowByMonth.map((m) => Math.max(m.income, m.expense)),
  );
  const netWorthValues = report.netWorthByMonth.map((p) => p.netWorth);
  const maxNetWorth = Math.max(1, ...netWorthValues.map((v) => Math.abs(v)));
  const maxCategorySpending = Math.max(
    1,
    ...report.spendingByCategory.map((c) => c.total),
  );
  const overBudget = report.budgetsOverview.filter((b) => b.percentage > 1);
  const withinBudget = report.budgetsOverview.filter((b) => b.percentage <= 1);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Period selector — a plain GET form, same pattern as the
            transactions filters: filtering works with zero client JS. */}
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
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

        <Card className="ledger-spine p-6 sm:p-8">
          <p className="font-display text-muted-foreground text-sm italic">
            Relatório · {formatDate(from)} — {formatDate(to)}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">
                Receitas no período
              </p>
              <p className="ledger-figure text-success mt-1 text-2xl font-semibold">
                {formatCurrency(report.totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">
                Despesas no período
              </p>
              <p className="ledger-figure text-destructive mt-1 text-2xl font-semibold">
                {formatCurrency(report.totalExpense)}
              </p>
            </div>
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          {/* Net worth over time — a single series (magnitude), so one hue
              and no legend box needed; the card title already names it. */}
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
                <div className="bg-muted/50 flex h-56 items-end gap-2 overflow-x-auto rounded-md p-4">
                  {report.netWorthByMonth.map((point) => (
                    <div
                      key={point.month.toISOString()}
                      className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <div
                        className={`w-full max-w-6 rounded-t-sm ${
                          point.netWorth >= 0 ? 'bg-primary' : 'bg-destructive'
                        }`}
                        style={{
                          height: `${Math.max(4, (Math.abs(point.netWorth) / maxNetWorth) * 100)}%`,
                        }}
                        title={`${formatMonthLabel(point.month)}: ${formatCurrency(point.netWorth)}`}
                      />
                      <span className="font-display text-muted-foreground text-xs capitalize">
                        {formatMonthLabel(point.month)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income vs expense by month — two series, so both a caption
              legend and the black/red-ink convention carry identity. */}
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
                <>
                  <div className="bg-muted/50 flex h-56 items-end gap-3 overflow-x-auto rounded-md p-4">
                    {report.cashFlowByMonth.map((month) => (
                      <div
                        key={month.month.toISOString()}
                        className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1"
                      >
                        <div className="flex h-40 w-full items-end gap-1">
                          <div
                            className="bg-success flex-1 rounded-t-sm"
                            style={{
                              height: `${(month.income / maxFlow) * 100}%`,
                            }}
                            title={`Receitas: ${formatCurrency(month.income)}`}
                          />
                          <div
                            className="bg-destructive flex-1 rounded-t-sm"
                            style={{
                              height: `${(month.expense / maxFlow) * 100}%`,
                            }}
                            title={`Despesas: ${formatCurrency(month.expense)}`}
                          />
                        </div>
                        <span className="font-display text-muted-foreground text-xs capitalize">
                          {formatMonthLabel(month.month)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="bg-success inline-block h-2 w-2" />{' '}
                      Receitas (tinta preta)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="bg-destructive inline-block h-2 w-2" />{' '}
                      Despesas (tinta vermelha)
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          {/* Gastos por categoria — a ranked list, all the same "job" (an
              expense), so a single red-ink bar carries the mark; identity
              comes from the row label, not a categorical hue. */}
          <Card className="p-6">
            <CardHeader className="p-0">
              <CardTitle className="text-xl">Gastos por categoria</CardTitle>
              <CardDescription>
                Despesas do período, da maior para a menor.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              {report.spendingByCategory.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma despesa registrada neste período.
                </p>
              ) : (
                <div className="space-y-3">
                  {report.spendingByCategory.map((category) => (
                    <div key={category.categoryId} className="ledger-row block">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{category.categoryName}</span>
                        <span className="ledger-figure text-destructive font-semibold">
                          {formatCurrency(category.total)}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5">
                        <div
                          className="bg-destructive h-1.5"
                          style={{
                            width: `${(category.total / maxCategorySpending) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Budgets at a glance — status color (good/warning/over), never
              a categorical hue, and never color alone: percentage is also
              printed as text. */}
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
                <div className="space-y-4">
                  {[...overBudget, ...withinBudget].map(
                    ({ budget, percentage, spent }) => (
                      <div key={budget.id} className="ledger-row block">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="ledger-figure">
                            {formatCurrency(spent, budget.currency)} /{' '}
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
                            style={{
                              width: `${Math.min(percentage, 1) * 100}%`,
                            }}
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
      </div>
    </AppShell>
  );
}
