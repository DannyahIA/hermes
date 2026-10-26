import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleAccountRepository } from '@/infra/repositories/drizzle-account.repository';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleRecurringTransactionRepository } from '@/infra/repositories/drizzle-recurring-transaction.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetFinancialReportUseCase } from '@/modules/reports/application/get-financial-report.use-case';
import { defaultPeriod } from '@/modules/reports/default-period';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { cn } from '@/shared/lib/cn';
import { toDateInput } from '@/shared/lib/local-day';

import { AccountsSection } from './accounts-section';
import { ComparisonsSection } from './comparisons-section';
import { ExportButtons } from './export-buttons';
import { OverviewSection } from './overview-section';
import { type ReportTab, ReportTabsNav } from './report-tabs-nav';

interface ReportsPageProps {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
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

  const periodQueryString = `from=${toDateInput(from)}&to=${toDateInput(to)}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Relatórios"
          actions={
            <ExportButtons
              periodQueryString={periodQueryString}
              activeTab={tab}
            />
          }
        />

        {/* Period selector — a plain GET form, same pattern as the
            transactions filters: filtering works with zero client JS. */}
        <form className="flex flex-wrap items-end gap-x-3 gap-y-2" method="get">
          {/* Keeps the active tab across a period change. */}
          <input type="hidden" name="tab" value={tab} />
          <label className="flex flex-col gap-1 text-xs font-medium">
            De
            <input
              type="date"
              name="from"
              defaultValue={toDateInput(from)}
              className={cn(FIELD_BASE_CLASSES, 'h-9 w-40 sm:text-sm')}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Até
            <input
              type="date"
              name="to"
              defaultValue={toDateInput(to)}
              className={cn(FIELD_BASE_CLASSES, 'h-9 w-40 sm:text-sm')}
            />
          </label>
          <Button type="submit" variant="outline">
            Aplicar período
          </Button>
        </form>

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
