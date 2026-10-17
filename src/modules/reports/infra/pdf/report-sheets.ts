export type ReportSheetId = 'overview' | 'accounts' | 'comparisons';

export interface ReportSheetMeta {
  /**
   * Sheet number, as on a drawing set's title block — "R" for relatório,
   * the way a set prefixes sheets by discipline. The code is stable per
   * sheet (R.02 is always "Por conta"), not a step in a sequence.
   */
  code: string;
  title: string;
  /** ASCII-safe, for the download's file name. */
  slug: string;
}

export const REPORT_SHEETS: Record<ReportSheetId, ReportSheetMeta> = {
  overview: { code: 'R.01', title: 'Visão geral', slug: 'visao-geral' },
  accounts: { code: 'R.02', title: 'Por conta', slug: 'por-conta' },
  comparisons: { code: 'R.03', title: 'Comparações', slug: 'comparacoes' },
};

export function parseReportSheetId(
  value: string | null | undefined,
): ReportSheetId {
  return value === 'accounts' || value === 'comparisons' ? value : 'overview';
}
