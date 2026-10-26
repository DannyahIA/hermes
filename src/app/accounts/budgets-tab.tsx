import { BudgetList } from '@/app/accounts/budget-list';
import { buildBudgetRows, installmentsLabel } from '@/app/accounts/budget-rows';
import { CreateBudgetDialog } from '@/app/budgets/create-budget-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Section, SectionHeader } from '@/components/ui/section';
import { DrizzleBudgetRepository } from '@/infra/repositories/drizzle-budget.repository';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { DrizzleTransactionRepository } from '@/infra/repositories/drizzle-transaction.repository';
import { GetBudgetProgressUseCase } from '@/modules/budgets/application/get-budget-progress.use-case';

/** The "Orçamentos" tab: each budget as a row, with its stage, its pace and the day it blows. */
export async function BudgetsTab({
  userId,
  now,
  installmentsThisMonth,
}: {
  userId: string;
  now: Date;
  /** What the card and loan installments add up to this month. */
  installmentsThisMonth: number;
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
  const rows = buildBudgetRows(progressList, categoryById, now);
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
        <BudgetList
          running={rows.running}
          ended={rows.ended}
          installmentsLabel={installmentsLabel(installmentsThisMonth, now)}
        />
      )}
    </Section>
  );
}
