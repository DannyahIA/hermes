'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult, createBudgetAction } from '@/app/budgets/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_CURRENCY } from '@/config/constants';
import { ROUTES } from '@/config/routes';

const initialState: ActionResult = { success: false };

interface BudgetFormProps {
  categories: Array<{ id: string; name: string }>;
}

export function BudgetForm({ categories }: BudgetFormProps) {
  const [state, formAction] = useActionState(createBudgetAction, initialState);

  if (categories.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Crie uma categoria antes de criar um orçamento.{' '}
          <Link
            href={ROUTES.categories}
            className="text-primary font-medium underline"
          >
            Ir para categorias
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="categoryId" className="text-muted-foreground text-sm">
            Categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={categories[0]?.id}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 flex h-11 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-all duration-200 outline-none focus-visible:ring-2"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="amount" className="text-muted-foreground text-sm">
            Valor do orçamento
          </label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="periodStart"
            className="text-muted-foreground text-sm"
          >
            Início do período
          </label>
          <Input id="periodStart" name="periodStart" type="date" required />
        </div>
        <div className="space-y-2">
          <label htmlFor="periodEnd" className="text-muted-foreground text-sm">
            Fim do período
          </label>
          <Input id="periodEnd" name="periodEnd" type="date" required />
        </div>
      </div>

      <input type="hidden" name="currency" value={DEFAULT_CURRENCY} />

      {state.error ? (
        <Alert className="border-destructive/40">
          <AlertDescription className="text-destructive">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? 'Salvando...' : 'Criar orçamento'}
    </Button>
  );
}
