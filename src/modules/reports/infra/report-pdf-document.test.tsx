import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';

import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';

import type { ReportSheetId } from './pdf/report-sheets';
import { ReportPdfDocument } from './report-pdf-document';

const month = (index: number) => new Date(2026, index, 1);
const noChange = { currentTotal: 0, previousTotal: 0, deltaPercent: null };

const report: FinancialReport = {
  totalIncome: 24100,
  totalExpense: 25300,
  cashFlowByMonth: [
    { month: month(0), income: 11800, expense: 13900 },
    { month: month(1), income: 12300, expense: 11400 },
  ],
  spendingByCategory: [
    { categoryId: 'c1', categoryName: 'Moradia', total: 15000 },
    { categoryId: 'c2', categoryName: 'Mercado', total: 10300 },
  ],
  netWorthByMonth: [
    { month: month(0), netWorth: -2100 },
    { month: month(1), netWorth: -1200 },
  ],
  budgetsOverview: [],
  categoryComparison: [
    {
      categoryId: 'c2',
      categoryName: 'Mercado',
      currentTotal: 10300,
      previousTotal: 0,
      deltaPercent: null,
    },
  ],
  recurringExpenseShare: {
    monthlyRecurringExpense: 3000,
    averageMonthlyIncome: 12050,
    percentage: 24.9,
  },
  accountSeries: [
    {
      accountId: 'a1',
      accountName: 'Conta corrente',
      balanceByMonth: [
        { month: month(0), netWorth: -2100 },
        { month: month(1), netWorth: -1200 },
      ],
      cashFlowByMonth: [
        { month: month(0), income: 11800, expense: 13900 },
        { month: month(1), income: 12300, expense: 11400 },
      ],
    },
  ],
  yearOverYear: { income: noChange, expense: noChange, byCategory: [] },
  sameMonthLastYear: { income: noChange, expense: noChange, byCategory: [] },
  trendStats: [
    {
      categoryId: 'c1',
      categoryName: 'Moradia',
      average: 7500,
      median: 7500,
      trend: 'estável',
    },
  ],
};

describe('ReportPdfDocument', () => {
  // Smoke test over real fonts and real layout: a font file that moved, or a
  // font the parser can't read, only fails at render time, never at import.
  it.each<ReportSheetId>(['overview', 'accounts', 'comparisons'])(
    'renders the %s sheet as a PDF',
    async (sheet) => {
      const pdf = await renderToBuffer(
        ReportPdfDocument({
          report,
          period: { from: month(0), to: new Date(2026, 1, 28) },
          sheet,
          issuedAt: new Date(2026, 9, 16, 14, 32),
          categoryNames: {},
        }),
      );

      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    },
    20000,
  );
});
