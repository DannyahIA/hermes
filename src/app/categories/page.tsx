import { CategoryCard } from '@/app/categories/category-card';
import { CreateCategoryDialog } from '@/app/categories/create-category-dialog';
import { AppShell } from '@/components/layout/app-shell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { requireCurrentUserId } from '@/infra/auth/session';
import { DrizzleCategoryRepository } from '@/infra/repositories/drizzle-category.repository';
import { GetCategoriesUseCase } from '@/modules/categories/application/get-categories.use-case';

export default async function CategoriesPage() {
  const userId = await requireCurrentUserId();
  const useCase = new GetCategoriesUseCase(new DrizzleCategoryRepository());
  const categories = await useCase.execute(userId);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Categorias
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Organize suas transações em categorias personalizadas.
            </p>
          </div>
          <CreateCategoryDialog />
        </section>

        <Card className="border-border/70 bg-card/80 p-6">
          <CardHeader className="p-0">
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Visão geral das suas categorias.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 flex flex-wrap gap-8 p-0">
            <div>
              <p className="text-muted-foreground text-sm">
                Total de categorias
              </p>
              <p className="dimension-figure mt-2 text-3xl font-semibold">
                {categories.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Arquivadas</p>
              <p className="dimension-figure mt-2 text-3xl font-semibold">
                {categories.filter((category) => category.archived).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4">
          {categories.length === 0 ? (
            <EmptyState
              title="Nenhuma categoria cadastrada."
              description="Crie sua primeira categoria para começar a organizar suas transações."
              action={<CreateCategoryDialog />}
            />
          ) : (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                name={category.name}
                description={category.description}
                color={category.color}
                archived={category.archived}
              />
            ))
          )}
        </section>
      </div>
    </AppShell>
  );
}
