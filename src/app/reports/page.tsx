import { AppShell } from '@/components/layout/app-shell';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';
import { defaultPeriod } from '@/modules/reports/default-period';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

import { AccountsSection } from './accounts-section';
import { ComparisonsSection } from './comparisons-section';
import { ExportButtons } from './export-buttons';
import { OverviewSection } from './overview-section';
import { type ReportTab, ReportTabsNav } from './report-tabs-nav';

interface ReportsPageProps {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}

/** Matches the `toISOString().slice(0, 10)` convention already used by the
 * transaction forms for a `<input type="date">` default value. */
function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseTab(value: string | undefined): ReportTab {
  return value === 'accounts' || value === 'comparisons' ? value : 'overview';
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const userId = await requireCurrentUserId();
  const params = await searchParams;

  const defaults = defaultPeriod();
  const from = params.from
    ? new Date(`${params.from}T00:00:00`)
    : defaults.from;
  const to = params.to ? new Date(`${params.to}T23:59:59.999`) : defaults.to;
  const tab = parseTab(params.tab);

  const report = await new GetFinancialReportUseCase(
    new DrizzleAccountRepository(),
    new DrizzleTransactionRepository(),
    new DrizzleBudgetRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleRecurringTransactionRepository(),
  ).execute(userId, { from, to });

  const periodQueryString = `from=${toDateInputValue(from)}&to=${toDateInputValue(to)}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Period selector — a plain GET form, same pattern as the
              transactions filters: filtering works with zero client JS. */}
          <form
            className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
            method="get"
          >
            {/* Keeps the active tab across a period change. */}
            <input type="hidden" name="tab" value={tab} />
            <input
              type="date"
              name="from"
              aria-label="De"
              defaultValue={toDateInputValue(from)}
              className={FIELD_BASE_CLASSES}
            />
            <input
              type="date"
              name="to"
              aria-label="Até"
              defaultValue={toDateInputValue(to)}
              className={FIELD_BASE_CLASSES}
            />
            <button
              type="submit"
              className="border-input bg-background hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
            >
              Filtrar período
            </button>
          </form>
          <ExportButtons
            periodQueryString={periodQueryString}
            activeTab={tab}
          />
        </div>

        <ReportTabsNav activeTab={tab} periodQueryString={periodQueryString} />

        {tab === 'overview' && (
          <OverviewSection report={report} from={from} to={to} />
        )}
        {tab === 'accounts' && (
          <AccountsSection accountSeries={report.accountSeries} />
        )}
        {tab === 'comparisons' && (
          <ComparisonsSection
            yearOverYear={report.yearOverYear}
            sameMonthLastYear={report.sameMonthLastYear}
            trendStats={report.trendStats}
          />
        )}
      </div>
    </AppShell>
  );
}
