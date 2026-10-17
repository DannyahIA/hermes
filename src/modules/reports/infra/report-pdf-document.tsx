import { Document } from '@react-pdf/renderer';

import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';

import { ACCOUNTS_NOTES, AccountsSheet } from './pdf/accounts-sheet';
import { COMPARISONS_NOTES, ComparisonsSheet } from './pdf/comparisons-sheet';
import { OVERVIEW_NOTES, OverviewSheet } from './pdf/overview-sheet';
import { formatPeriod } from './pdf/pdf-format';
import { ReportSheet } from './pdf/report-sheet';
import { REPORT_SHEETS, type ReportSheetId } from './pdf/report-sheets';

interface ReportPdfDocumentProps {
  report: FinancialReport;
  period: { from: Date; to: Date };
  /** Which tab of `/reports` this export is — each tab prints as its own sheet. */
  sheet: ReportSheetId;
  issuedAt: Date;
  /** Budgets only carry a category id; the overview sheet prints the name. */
  categoryNames: Record<string, string>;
}

/**
 * The report as a printed drawing sheet (see ./pdf/pdf-theme.ts): one sheet
 * per tab, numbered R.01–R.03 in its title block, flowing onto as many A4
 * pages as its content needs.
 */
export function ReportPdfDocument({
  report,
  period,
  sheet,
  issuedAt,
  categoryNames,
}: ReportPdfDocumentProps) {
  const meta = REPORT_SHEETS[sheet];
  const notes = {
    overview: OVERVIEW_NOTES,
    accounts: ACCOUNTS_NOTES,
    comparisons: COMPARISONS_NOTES,
  }[sheet];

  return (
    <Document
      title={`Relatório financeiro, ${meta.title} — ${formatPeriod(period.from, period.to)}`}
      author="Hermes"
      creator="Hermes"
      producer="Hermes"
      language="pt-BR"
    >
      <ReportSheet
        sheet={meta}
        period={period}
        issuedAt={issuedAt}
        notes={notes}
      >
        {sheet === 'overview' && (
          <OverviewSheet report={report} categoryNames={categoryNames} />
        )}
        {sheet === 'accounts' && (
          <AccountsSheet accounts={report.accountSeries} />
        )}
        {sheet === 'comparisons' && (
          <ComparisonsSheet
            yearOverYear={report.yearOverYear}
            sameMonthLastYear={report.sameMonthLastYear}
            trendStats={report.trendStats}
            issuedAt={issuedAt}
          />
        )}
      </ReportSheet>
    </Document>
  );
}
