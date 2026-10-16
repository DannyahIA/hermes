import type { FinancialReport } from './get-financial-report.use-case';

const HEADER = ['Categoria', 'Total no período'];

/**
 * Shapes the report into CSV rows. Amounts use a plain `123.45` decimal
 * rather than a localized string: this file is meant to be re-read by a
 * spreadsheet, and a pt-BR "R$ 1.234,56" would import as text.
 */
export function buildReportCsvRows(report: FinancialReport): string[][] {
  const rows = report.spendingByCategory.map((category) => [
    category.categoryName,
    category.total.toFixed(2),
  ]);
  return [HEADER, ...rows];
}
