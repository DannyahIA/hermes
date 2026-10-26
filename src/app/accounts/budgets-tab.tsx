import { BudgetProgressCard } from '@/app/budgets/budget-progress-card';
import { CreateBudgetDialog } from '@/app/budgets/create-budget-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Section, SectionHeader } from '@/components/ui/section';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetBudgetProgressUseCase } from '@/modules/budgets/application/get-budget-progress.use-case';

/** The "Orçamentos" tab: the budgets list, moved here from /budgets. */
export async function BudgetsTab({
  userId,
  now,
}: {
  userId: string;
  now: Date;
}) {
  const [categories, progressList] = await Promise.all([
    new DrizzleCategoryRepository().findByUserId(userId),
    new GetBudgetProgressUseCase(
      new DrizzleBudgetRepository(),
      new DrizzleTransactionRepository(),
    ).execute(userId, now),
  ]);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    name: category.name,
  }));

  return (
    <Section>
      <SectionHeader
        title="Orçamentos"
        description="Quanto pretende gastar em cada categoria, e como o mês está indo."
        action={
          categoryOptions.length > 0 && progressList.length > 0 ? (
            <CreateBudgetDialog categories={categoryOptions} />
          ) : undefined
        }
      />
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
    </Section>
  );
}
