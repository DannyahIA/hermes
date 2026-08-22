import { CategoryCard } from '@/app/categories/category-card';
import { CreateCategoryCard } from '@/app/categories/create-category-card';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
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
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <CreateCategoryCard />

          <Card className="border-border/70 bg-card/80 p-6">
            <CardHeader className="p-0">
              <CardTitle>Resumo</CardTitle>
              <CardDescription>
                Visão geral das suas categorias.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-4 p-0">
              <div className="bg-primary/10 rounded-xl p-5">
                <p className="text-muted-foreground text-sm">
                  Total de categorias
                </p>
                <p className="dimension-figure mt-2 text-3xl font-semibold">
                  {categories.length}
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  {categories.filter((category) => category.archived).length}{' '}
                  arquivada(s)
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {categories.length === 0 ? (
            <EmptyState
              title="Nenhuma categoria cadastrada."
              description="Crie sua primeira categoria para começar a organizar suas transações."
              action={
                <Button asChild>
                  <a href="#create-category">Criar primeira categoria</a>
                </Button>
              }
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
