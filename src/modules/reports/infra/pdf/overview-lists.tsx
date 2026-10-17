import { StyleSheet, Text, View } from '@react-pdf/renderer';

import type { BudgetProgress } from '@/modules/budgets/application/get-budget-progress.use-case';
import type { CategoryComparison } from '@/modules/reports/application/metrics/calculate-category-comparison';
import type { CategorySpending } from '@/modules/reports/application/metrics/calculate-category-spending';
import type { RecurringExpenseShare } from '@/modules/reports/application/metrics/calculate-recurring-expense-share';
import { formatCurrency } from '@/shared/lib/format-currency';

import { formatDelta, formatPercent } from './pdf-format';
import { PdfTable } from './pdf-table';
import { FONT, INK, textStyles, TYPE } from './pdf-theme';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: INK.construction,
    borderBottomStyle: 'dashed',
  },
  name: {
    fontSize: TYPE.caption + 0.5,
  },
  bar: {
    height: 5,
    backgroundColor: INK.blueline,
  },
  figure: {
    fontFamily: FONT.figure,
    fontSize: TYPE.caption,
    textAlign: 'right',
  },
  meterTrack: {
    height: 3,
    marginTop: 3,
    backgroundColor: INK.track,
  },
  // A standalone figure, so proportional digits (Plex Sans) rather than the
  // mono, whose equal-width digits only earn their keep down a column.
  bigFigure: {
    fontWeight: 600,
    fontSize: TYPE.title,
  },
});

/** Ranked bars in one ink: every bar is the same kind of thing (an expense), so color would add nothing the bar length doesn't. */
export function CategoryBars({
  categories,
  totalExpense,
}: {
  categories: CategorySpending[];
  totalExpense: number;
}) {
  if (categories.length === 0) {
    return (
      <Text style={textStyles.empty}>
        Nenhuma despesa registrada neste período.
      </Text>
    );
  }

  const largest = Math.max(...categories.map((c) => c.total));
  return (
    <View>
      {categories.map((category, index) => (
        <View
          key={category.categoryId}
          wrap={false}
          style={
            index === categories.length - 1
              ? [styles.row, { borderBottomWidth: 0 }]
              : styles.row
          }
        >
          <Text style={[styles.name, { width: 118 }]}>
            {category.categoryName}
          </Text>
          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <View
              style={[
                styles.bar,
                { width: `${(category.total / largest) * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.figure, { width: 80 }]}>
            {formatCurrency(category.total)}
          </Text>
          <Text style={[styles.figure, { width: 42, color: INK.graphite }]}>
            {totalExpense > 0
              ? formatPercent((category.total / totalExpense) * 100, true)
              : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Status ink, never a category hue — and the percentage is always printed beside it. */
function meterFill(ratio: number): string {
  if (ratio > 1) return INK.redline;
  if (ratio >= 0.8) return INK.amber;
  return INK.blueline;
}

export function BudgetMeters({
  budgets,
  categoryNames,
}: {
  budgets: BudgetProgress[];
  categoryNames: Record<string, string>;
}) {
  if (budgets.length === 0) {
    return (
      <Text style={textStyles.empty}>
        Nenhum orçamento cadastrado. Defina limites por categoria em Orçamentos
        para acompanhá-los aqui.
      </Text>
    );
  }

  const ordered = [
    ...budgets.filter((b) => b.percentage > 1),
    ...budgets.filter((b) => b.percentage <= 1),
  ];
  return (
    <View>
      {ordered.map(({ budget, spent, percentage }) => (
        <View
          key={budget.id}
          wrap={false}
          style={[
            styles.row,
            {
              flexDirection: 'column',
              alignItems: 'stretch',
              paddingBottom: 6,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[styles.name, { flex: 1 }]}>
              {categoryNames[budget.categoryId] ?? 'Categoria removida'}
            </Text>
            <Text style={[styles.figure, { color: INK.graphite }]}>
              {formatCurrency(spent, budget.currency)} de{' '}
              {formatCurrency(budget.amount, budget.currency)}
            </Text>
            <Text
              style={[
                styles.figure,
                {
                  width: 44,
                  color: percentage > 1 ? INK.redline : INK.text,
                },
              ]}
            >
              {formatPercent(percentage * 100)}
            </Text>
          </View>
          <View style={styles.meterTrack}>
            <View
              style={{
                height: 3,
                width: `${Math.min(percentage, 1) * 100}%`,
                backgroundColor: meterFill(percentage),
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

export function RecurringShare({ share }: { share: RecurringExpenseShare }) {
  if (share.percentage === null) {
    return (
      <Text style={textStyles.empty}>
        Sem receita registrada neste período para calcular a proporção.
      </Text>
    );
  }

  return (
    <View>
      <Text style={styles.bigFigure}>{formatPercent(share.percentage)}</Text>
      <Text style={[textStyles.caption, { marginTop: 2 }]}>
        {formatCurrency(share.monthlyRecurringExpense)} de{' '}
        {formatCurrency(share.averageMonthlyIncome)} por mês
      </Text>
      <View style={[styles.meterTrack, { height: 4, marginTop: 6 }]}>
        <View
          style={{
            height: 4,
            width: `${Math.min(share.percentage, 100)}%`,
            backgroundColor: share.percentage > 50 ? INK.redline : INK.blueline,
          }}
        />
      </View>
    </View>
  );
}

export function GrowingCategories({
  comparisons,
}: {
  comparisons: CategoryComparison[];
}) {
  const growing = comparisons
    .filter((c) => c.currentTotal > c.previousTotal)
    .slice(0, 5);
  if (growing.length === 0) {
    return (
      <Text style={textStyles.empty}>
        Nenhuma categoria cresceu em relação ao período anterior.
      </Text>
    );
  }

  return (
    <PdfTable
      rows={growing}
      rowKey={(c) => c.categoryId}
      columns={[
        { header: 'Categoria', render: (c) => c.categoryName },
        {
          header: 'No período',
          width: 78,
          figure: true,
          render: (c) => formatCurrency(c.currentTotal),
        },
        {
          header: 'Variação',
          width: 62,
          figure: true,
          color: () => INK.redline,
          render: (c) =>
            // No spending in the previous period, so there's no ratio —
            // only the direction.
            c.deltaPercent === null ? '↑ novo' : formatDelta(c.deltaPercent),
        },
      ]}
    />
  );
}
