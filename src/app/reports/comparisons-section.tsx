import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatTile } from '@/components/ui/stat-tile';
import type { PeriodComparison } from '@/modules/reports/application/metrics/calculate-period-comparison';
import type { CategoryTrendStats } from '@/modules/reports/application/metrics/calculate-trend-stats';
import { formatCurrency } from '@/shared/lib/format-currency';

interface ComparisonsSectionProps {
  yearOverYear: PeriodComparison;
  sameMonthLastYear: PeriodComparison;
  trendStats: CategoryTrendStats[];
}

const TREND_LABELS: Record<CategoryTrendStats['trend'], string> = {
  subindo: 'Subindo',
  caindo: 'Caindo',
  estável: 'Estável',
  insuficiente: 'Dado insuficiente',
};

/**
 * The "Comparações" tab. These are a handful of headline numbers with a
 * delta, not a shape over time, so they are stat tiles rather than charts.
 * Note both comparisons are anchored to today, NOT the page's period filter
 * (spec §3.5) — the card descriptions say so, since the filter sits right
 * above them.
 */
export function ComparisonsSection({
  yearOverYear,
  sameMonthLastYear,
  trendStats,
}: ComparisonsSectionProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="p-0">
          <CardTitle>Ano a ano</CardTitle>
          <CardDescription>
            1º de janeiro até hoje, comparado ao mesmo intervalo no ano
            anterior. Não segue o filtro de período acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          <StatTile
            label="Receitas"
            value={formatCurrency(yearOverYear.income.currentTotal)}
            deltaPercent={yearOverYear.income.deltaPercent}
            upIsGood
          />
          <StatTile
            label="Despesas"
            value={formatCurrency(yearOverYear.expense.currentTotal)}
            deltaPercent={yearOverYear.expense.deltaPercent}
            upIsGood={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-0">
          <CardTitle>Mesmo mês, ano passado</CardTitle>
          <CardDescription>
            O mês atual comparado ao mesmo mês do ano anterior. Não segue o
            filtro de período acima.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          <StatTile
            label="Receitas"
            value={formatCurrency(sameMonthLastYear.income.currentTotal)}
            deltaPercent={sameMonthLastYear.income.deltaPercent}
            upIsGood
          />
          <StatTile
            label="Despesas"
            value={formatCurrency(sameMonthLastYear.expense.currentTotal)}
            deltaPercent={sameMonthLastYear.expense.deltaPercent}
            upIsGood={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-0">
          <CardTitle>Tendência por categoria</CardTitle>
          <CardDescription>
            Média, mediana e direção da despesa mensal no período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 overflow-x-auto p-0">
          {trendStats.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sem dados suficientes no período selecionado.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-border border-b text-left">
                  <th scope="col" className="py-2 pr-4">
                    Categoria
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Média mensal
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Mediana mensal
                  </th>
                  <th scope="col" className="py-2 text-right">
                    Tendência
                  </th>
                </tr>
              </thead>
              <tbody>
                {trendStats.map((stat) => (
                  <tr
                    key={stat.categoryId}
                    className="border-border border-b last:border-0"
                  >
                    <th scope="row" className="py-2 pr-4 text-left font-medium">
                      {stat.categoryName}
                    </th>
                    <td className="dimension-figure py-2 pr-4 text-right">
                      {formatCurrency(stat.average)}
                    </td>
                    <td className="dimension-figure py-2 pr-4 text-right">
                      {formatCurrency(stat.median)}
                    </td>
                    <td className="py-2 text-right">
                      {TREND_LABELS[stat.trend]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
