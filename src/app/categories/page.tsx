import Link from 'next/link';

import {
  formatChange,
  monthName,
  monthNameFrom,
  monthOf,
  resolveMonth,
  shiftMonth,
} from '@/app/categories/category-display';
import { CategoryList } from '@/app/categories/category-list';
import { CategoryShareBar } from '@/app/categories/category-share-bar';
import { CategorySuggestions } from '@/app/categories/category-suggestions';
import { CreateCategoryDialog } from '@/app/categories/create-category-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/routes';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleMerchantRuleRepository } from '@/infra/repositories/drizzle-merchant-rule.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetCategoriesOverviewUseCase } from '@/modules/categories/application/get-categories-overview.use-case';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

interface CategoriesPageProps {
  searchParams: Promise<{ mes?: string }>;
}

export default async function CategoriesPage({
  searchParams,
}: CategoriesPageProps) {
  const userId = await requireCurrentUserId();
  const { mes } = await searchParams;
  const now = new Date();
  const month = resolveMonth(mes, now);
  const overview = await new GetCategoriesOverviewUseCase(
    new DrizzleTransactionRepository(),
    new DrizzleCategoryRepository(),
    new DrizzleMerchantRuleRepository(),
    new DrizzleBudgetRepository(),
  ).execute({ userId, month, now });

  const hasCategories =
    overview.rows.length +
      overview.incomeRows.length +
      overview.archived.length >
    0;
  const { create, archive, merge } = overview.suggestions;
  const hasSuggestions = create.length + archive.length + merge.length > 0;
  const change = formatChange(overview.deltaPercent);
  const previousName = monthNameFrom(overview.previousMonth, month);
  const nextMonth = shiftMonth(month, 1);
  const canGoNext = nextMonth <= monthOf(now);

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Categorias" actions={<CreateCategoryDialog />} />

        {hasCategories ? (
          <>
            <nav
              aria-label="Mês"
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm"
            >
              <Link
                href={`${ROUTES.categories}?mes=${overview.previousMonth}`}
                className="text-muted-foreground hover:text-foreground focus-visible:outline-ring justify-self-start rounded-sm px-1 focus-visible:outline-2"
              >
                ‹ {previousName}
              </Link>
              <p className="font-display font-semibold">
                {monthName(month, true)}
              </p>
              {canGoNext ? (
                <Link
                  href={`${ROUTES.categories}?mes=${nextMonth}`}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-ring justify-self-end rounded-sm px-1 focus-visible:outline-2"
                >
                  {monthNameFrom(nextMonth, month)} ›
                </Link>
              ) : (
                <span />
              )}
            </nav>

            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
                <div>
                  <p className="text-muted-foreground text-sm">Gasto no mês</p>
                  <p className="dimension-figure text-figure mt-0.5 font-semibold">
                    {formatCurrency(overview.spent)}
                  </p>
                </div>
                <p className="text-sm">
                  <span
                    className={cn(
                      'dimension-figure font-medium',
                      change.className,
                    )}
                  >
                    {change.text}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    vs {previousName}
                  </span>
                </p>
              </div>
              <CategoryShareBar
                rows={overview.rows}
                spent={overview.spent}
                uncategorized={overview.uncategorized}
              />
            </Card>

            {hasSuggestions && (
              <CategorySuggestions suggestions={overview.suggestions} />
            )}

            <Card className="overflow-hidden p-0">
              <CategoryList
                rows={overview.rows}
                incomeRows={overview.incomeRows}
                archived={overview.archived}
                month={month}
              />
            </Card>
          </>
        ) : (
          <EmptyState
            title="Nenhuma categoria cadastrada."
            description="Crie sua primeira categoria para começar a organizar suas transações."
            action={<CreateCategoryDialog />}
          />
        )}
      </div>
    </AppShell>
  );
}
