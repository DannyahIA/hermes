import { StyleSheet, Text, View } from '@react-pdf/renderer';

import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';
import type { MonthlyCashFlow } from '@/shared/lib/build-monthly-cash-flow';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatMonthLabel } from '@/shared/lib/format-date';

import { END_LABEL_BAND, MonthlyBars } from './monthly-bars';
import {
  BudgetMeters,
  CategoryBars,
  GrowingCategories,
  RecurringShare,
} from './overview-lists';
import { formatMonthYear, monthKey } from './pdf-format';
import { PdfTable } from './pdf-table';
import { HALF_WIDTH, INK, textStyles, TYPE } from './pdf-theme';
import { ResultDimension } from './result-dimension';
import { SheetSection } from './sheet-section';

export const OVERVIEW_NOTES = [
  'Valores em reais, somando as contas visíveis. Transferências entre as suas próprias contas não contam como receita nem despesa.',
  'O patrimônio de cada mês é reconstruído a partir do saldo atual das contas; meses depois da data de emissão ficam em branco.',
  'Orçamentos mostram o progresso atual de cada orçamento, qualquer que seja o período deste relatório.',
  'Compara as recorrências ativas na data de emissão com a renda média mensal do período.',
  'O período anterior é o intervalo de mesma duração imediatamente antes deste.',
];

const CHART_HEIGHT = 84;

const styles = StyleSheet.create({
  pair: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Same height as MonthlyBars' end-label band, so the two charts in the
  // pair share a baseline and their month labels line up.
  legend: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: END_LABEL_BAND,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  swatch: {
    width: 7,
    height: 7,
    marginRight: 4,
  },
});

interface MonthRow {
  month: Date;
  income: number;
  expense: number;
  netWorth: number | null;
}

function monthRows(report: FinancialReport): MonthRow[] {
  const netWorthByMonth = new Map(
    report.netWorthByMonth.map((p) => [monthKey(p.month), p.netWorth]),
  );
  return report.cashFlowByMonth.map((m: MonthlyCashFlow) => ({
    month: m.month,
    income: m.income,
    expense: m.expense,
    netWorth: netWorthByMonth.get(monthKey(m.month)) ?? null,
  }));
}

const NO_DATA = 'Sem dados suficientes para este período.';

export function OverviewSheet({
  report,
  categoryNames,
}: {
  report: FinancialReport;
  categoryNames: Record<string, string>;
}) {
  const rows = monthRows(report);
  const lastNetWorth = report.netWorthByMonth.at(-1);
  const overBudget = report.budgetsOverview.filter((b) => b.percentage > 1);
  const hasMovement = rows.some((r) => r.income > 0 || r.expense > 0);
  const budgetStatus =
    report.budgetsOverview.length === 0
      ? ''
      : overBudget.length > 0
        ? `${overBudget.length} acima do limite. `
        : 'Todos dentro do limite. ';

  return (
    <View>
      <SheetSection
        title="Resultado do período"
        caption="Receitas e despesas desenhadas na mesma escala; a medida abaixo delas é a diferença."
        keepTogether
      >
        <ResultDimension
          income={report.totalIncome}
          expense={report.totalExpense}
        />
      </SheetSection>

      <View style={styles.pair} wrap={false}>
        <SheetSection
          title="Patrimônio"
          caption="Saldo consolidado no fim de cada mês (nota 2)."
          width={HALF_WIDTH}
        >
          {lastNetWorth ? (
            <MonthlyBars
              months={report.netWorthByMonth.map((p) => p.month)}
              series={[
                {
                  values: report.netWorthByMonth.map((p) => p.netWorth),
                  fill: (v) => (v >= 0 ? INK.blueline : INK.redline),
                },
              ]}
              width={HALF_WIDTH}
              height={CHART_HEIGHT}
              endLabel={`${formatMonthLabel(lastNetWorth.month)} ${formatCurrency(lastNetWorth.netWorth)}`}
            />
          ) : (
            <Text style={textStyles.empty}>{NO_DATA}</Text>
          )}
        </SheetSection>

        <SheetSection
          title="Receitas e despesas por mês"
          caption="Entradas e saídas de cada mês do período."
          width={HALF_WIDTH}
        >
          {hasMovement ? (
            <View>
              <View style={styles.legend}>
                <LegendItem color={INK.blueline} label="Receitas" />
                <LegendItem color={INK.redline} label="Despesas" />
              </View>
              <MonthlyBars
                months={rows.map((r) => r.month)}
                series={[
                  {
                    values: rows.map((r) => r.income),
                    fill: () => INK.blueline,
                  },
                  {
                    values: rows.map((r) => r.expense),
                    fill: () => INK.redline,
                  },
                ]}
                width={HALF_WIDTH}
                height={CHART_HEIGHT - END_LABEL_BAND}
              />
            </View>
          ) : (
            <Text style={textStyles.empty}>{NO_DATA}</Text>
          )}
        </SheetSection>
      </View>

      {rows.length > 0 && (
        <SheetSection
          title="Mês a mês"
          caption="Os valores dos dois gráficos acima."
        >
          <PdfTable
            rows={rows}
            rowKey={(r) => monthKey(r.month)}
            footer={[
              'Total',
              formatCurrency(report.totalIncome),
              formatCurrency(report.totalExpense),
              formatCurrency(report.totalIncome - report.totalExpense),
            ]}
            columns={[
              {
                header: 'Mês',
                width: 84,
                render: (r) => formatMonthYear(r.month),
              },
              {
                header: 'Receitas',
                figure: true,
                render: (r) => formatCurrency(r.income),
              },
              {
                header: 'Despesas',
                figure: true,
                render: (r) => formatCurrency(r.expense),
              },
              {
                header: 'Resultado',
                figure: true,
                color: (r) => (r.income < r.expense ? INK.redline : undefined),
                render: (r) => formatCurrency(r.income - r.expense),
              },
              {
                header: 'Patrimônio no fim do mês',
                figure: true,
                render: (r) =>
                  r.netWorth === null ? '' : formatCurrency(r.netWorth),
              },
            ]}
          />
        </SheetSection>
      )}

      <SheetSection
        title="Gastos por categoria"
        caption="Despesas do período, da maior para a menor, com a parte de cada uma no total."
      >
        <CategoryBars
          categories={report.spendingByCategory}
          totalExpense={report.totalExpense}
        />
      </SheetSection>

      <SheetSection
        title="Orçamentos"
        caption={`${budgetStatus}Progresso atual de cada orçamento (nota 3).`}
      >
        <BudgetMeters
          budgets={report.budgetsOverview}
          categoryNames={categoryNames}
        />
      </SheetSection>

      <View style={styles.pair} wrap={false}>
        <SheetSection
          title="Gastos recorrentes"
          caption="Parte da renda mensal comprometida com recorrências ativas (nota 4)."
          width={HALF_WIDTH}
        >
          <RecurringShare share={report.recurringExpenseShare} />
        </SheetSection>
        <SheetSection
          title="Comparação com o período anterior"
          caption="Categorias que mais cresceram em valor (nota 5)."
          width={HALF_WIDTH}
        >
          <GrowingCategories comparisons={report.categoryComparison} />
        </SheetSection>
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={{ fontSize: TYPE.label + 0.5, color: INK.graphite }}>
        {label}
      </Text>
    </View>
  );
}
