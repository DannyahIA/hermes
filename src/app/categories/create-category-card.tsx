import { createCategoryAction } from '@/app/categories/actions';
import { CategoryForm } from '@/app/categories/category-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function CreateCategoryCard() {
  return (
    <Card id="create-category" className="border-border/70 bg-card/80 p-6">
      <CardHeader className="p-0">
        <CardTitle>Nova categoria</CardTitle>
        <CardDescription>Defina nome, descrição e cor.</CardDescription>
      </CardHeader>
      <CardContent className="mt-4 p-0">
        <CategoryForm
          action={createCategoryAction}
          submitLabel="Criar categoria"
        />
      </CardContent>
    </Card>
  );
}
