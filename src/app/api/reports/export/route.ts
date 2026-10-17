import { renderToBuffer } from '@react-pdf/renderer';
import type { NextRequest } from 'next/server';

import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { buildReportCsvRows } from '@/modules/reports/application/build-report-csv-rows';
import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';
import { defaultPeriod } from '@/modules/reports/default-period';
import {
  parseReportSheetId,
  REPORT_SHEETS,
} from '@/modules/reports/infra/pdf/report-sheets';
import { ReportPdfDocument } from '@/modules/reports/infra/report-pdf-document';
import { buildCsv } from '@/shared/lib/csv';

export const runtime = 'nodejs';

/** "2026-01-31" from local date parts — `toISOString()` would shift to UTC and can land on the wrong day. */
function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Exports the same report `/reports` renders, as CSV or PDF. Reads the same
 * `from`/`to` query params the page uses, so an "Exportar" link can simply
 * carry the page's current period.
 */
export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return new Response('Não autenticado.', { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const format = params.get('format') === 'pdf' ? 'pdf' : 'csv';
  const defaults = defaultPeriod();
  const fromParam = params.get('from');
  const toParam = params.get('to');
  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaults.from;
  const to = toParam ? new Date(`${toParam}T23:59:59.999`) : defaults.to;
  // One instant for the whole export: the "anchored to today" comparisons
  // are computed against the same date the PDF prints as "Emitido em".
  const issuedAt = new Date();

  const categoryRepository = new DrizzleCategoryRepository();
  const report = await new GetFinancialReportUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    categoryRepository,
    new DrizzleRecurringTransactionRepository(),
  ).execute(userId, { from, to }, issuedAt);

  if (format === 'pdf') {
    const sheet = parseReportSheetId(params.get('tab'));
    // Budgets only carry a category id; the printed sheet names them.
    const categories = await categoryRepository.findByUserId(userId);
    const categoryNames = Object.fromEntries(
      categories.map((category) => [category.id, category.name]),
    );

    // Buffer rather than stream: a two-page report is a few dozen KB, and
    // renderToStream's declared NodeJS.ReadableStream can't be handed to
    // Response without a conversion that buys nothing at this size.
    //
    // Calling the component as a plain function (not JSX) keeps this route a
    // .ts file — ReportPdfDocument has no hooks, so invoking it directly just
    // returns the <Document> element renderToBuffer wants.
    const pdf = await renderToBuffer(
      ReportPdfDocument({
        report,
        period: { from, to },
        sheet,
        issuedAt,
        categoryNames,
      }),
    );
    const fileName = `hermes-relatorio-${REPORT_SHEETS[sheet].slug}-${localIsoDate(from)}-a-${localIsoDate(to)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }

  // UTF-8 BOM so Excel opens accented characters correctly instead of
  // mojibake — same convention as the transactions export.
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + buildCsv(buildReportCsvRows(report));
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="relatorio.csv"',
    },
  });
}
