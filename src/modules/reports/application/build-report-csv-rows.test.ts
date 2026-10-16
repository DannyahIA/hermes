import { describe, expect, it } from 'vitest';

import { buildReportCsvRows } from './build-report-csv-rows';
import type { FinancialReport } from './get-financial-report.use-case';

function emptyReport(overrides: Partial<FinancialReport> = {}): FinancialReport {
  const emptyDelta = {
    currentTotal: 0,
    previousTotal: 0,
    deltaPercent: null,
  };
  return {
    totalIncome: 0,
    totalExpense: 0,
    cashFlowByMonth: [],
    spendingByCategory: [],
    netWorthByMonth: [],
    budgetsOverview: [],
    categoryComparison: [],
    recurringExpenseShare: {
      monthlyRecurringExpense: 0,
      averageMonthlyIncome: 0,
      percentage: null,
    },
    accountSeries: [],
    yearOverYear: {
      income: emptyDelta,
      expense: emptyDelta,
      byCategory: [],
    },
    sameMonthLastYear: {
      income: emptyDelta,
      expense: emptyDelta,
      byCategory: [],
    },
    trendStats: [],
    ...overrides,
  };
}

describe('buildReportCsvRows', () => {
  it('includes a header row and one row per category spending entry', () => {
    const report = emptyReport({
      spendingByCategory: [
        { categoryId: 'cat-1', categoryName: 'Alimentação', total: 150.5 },
      ],
    });
    const rows = buildReportCsvRows(report);
    expect(rows[0]).toEqual(['Categoria', 'Total no período']);
    expect(rows[1]).toEqual(['Alimentação', '150.50']);
  });

  it('renders a valid header-only table when there is no spending', () => {
    const rows = buildReportCsvRows(emptyReport());
    expect(rows).toEqual([['Categoria', 'Total no período']]);
  });
});
