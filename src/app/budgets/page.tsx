import { BudgetProgressCard } from '@/app/budgets/budget-progress-card';
import { CreateBudgetDialog } from '@/app/budgets/create-budget-dialog';
import { AppShell } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetBudgetProgressUseCase } from '@/modules/budgets/application/get-budget-progress.use-case';

export default async function BudgetsPage() {
  const userId = await requireCurrentUserId();

  const categoryRepository = new DrizzleCategoryRepository();
  const categories = await categoryRepository.findByUserId(userId);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  const getBudgetProgress = new GetBudgetProgressUseCase(
    new DrizzleBudgetRepository(),
    new DrizzleTransactionRepository(),
  );
  const progressList = await getBudgetProgress.execute(userId);

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Orçamentos"
          description="Defina quanto pretende gastar em cada categoria e acompanhe seu progresso ao longo do mês."
          actions={
            categoryOptions.length > 0 ? (
              <CreateBudgetDialog categories={categoryOptions} />
            ) : undefined
          }
        />

        <section>
          {progressList.length === 0 ? (
            <EmptyState
              title="Nenhum orçamento cadastrado."
              description={
                categoryOptions.length > 0
                  ? 'Crie seu primeiro orçamento para acompanhar seus limites de gastos.'
                  : 'Crie uma categoria antes de criar um orçamento.'
              }
              action={
                categoryOptions.length > 0 ? (
                  <CreateBudgetDialog categories={categoryOptions} />
                ) : undefined
              }
            />
          ) : (
            <ul className="sheet-surface divide-border divide-y">
              {progressList.map((progress) => {
                const category = categoryById.get(progress.budget.categoryId);
                return (
                  <BudgetProgressCard
                    key={progress.budget.id}
                    progress={progress}
                    categoryName={category?.name ?? 'Categoria removida'}
                    categoryColor={category?.color}
                  />
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
