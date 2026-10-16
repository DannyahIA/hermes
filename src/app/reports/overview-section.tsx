import Link from 'next/link';

import { CashFlowChart } from '@/components/reports/cash-flow-chart';
import { CategorySpendingChart } from '@/components/reports/category-spending-chart';
import { NetWorthChart } from '@/components/reports/net-worth-chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/config/routes';
import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

interface OverviewSectionProps {
  report: FinancialReport;
  from: Date;
  to: Date;
}

/** Everything scoped to the selected period: totals, the two time-series charts, categories, budgets and recurrences. */
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Comparação com o período anterior — categories whose spending
            grew, ranked; red ink for growth in expense. */}
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

        {/* Gastos recorrentes — share of average monthly income committed
            to active recurring expenses; status color, never a
            categorical hue, and the percentage is always printed too. */}
        <Card className="p-6">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Gastos recorrentes</CardTitle>
            <CardDescription>
              Quanto da sua renda mensal é comprometido com recorrências
              ativas.
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
