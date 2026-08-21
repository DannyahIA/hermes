import { BudgetForm } from '@/app/budgets/budget-form';
import { BudgetProgressCard } from '@/app/budgets/budget-progress-card';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Orçamentos
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Defina quanto pretende gastar em cada categoria e acompanhe seu
              progresso ao longo do mês.
            </p>
          </div>
        </section>

        <section id="novo-orcamento">
          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Novo orçamento</CardTitle>
              <CardDescription>
                Escolha a categoria, o valor limite e o período.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              {/* Client Components can only receive plain objects, not
                  entity class instances — map before crossing the boundary. */}
              <BudgetForm
                categories={categories.map((category) => ({
                  id: category.id,
                  name: category.name,
                }))}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {progressList.length === 0 ? (
            <Card className="border-border/70 bg-card/80 p-10 text-center">
              <p className="text-lg font-semibold">
                Nenhum orçamento cadastrado.
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Crie seu primeiro orçamento para acompanhar seus limites de
                gastos.
              </p>
              {categories.length > 0 ? (
                <Button className="mt-4" asChild>
                  <a href="#novo-orcamento">Criar primeiro orçamento</a>
                </Button>
              ) : null}
            </Card>
          ) : (
            progressList.map((progress) => {
              const category = categoryById.get(progress.budget.categoryId);
              return (
                <BudgetProgressCard
                  key={progress.budget.id}
                  progress={progress}
                  categoryName={category?.name ?? 'Categoria removida'}
                  categoryColor={category?.color}
                />
              );
            })
          )}
        </section>
      </div>
    </AppShell>
  );
}
