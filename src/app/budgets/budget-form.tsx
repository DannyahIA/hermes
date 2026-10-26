'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/budgets/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_CURRENCY } from '@/config/constants';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';

type BudgetKindChoice = 'monthly' | 'fixed';

const KIND_OPTIONS: Array<{
  value: BudgetKindChoice;
  label: string;
  hint: string;
}> = [
  {
    value: 'monthly',
    label: 'Todo mês',
    hint: 'O limite recomeça a cada mês.',
  },
  {
    value: 'fixed',
    label: 'Por prazo',
    hint: 'O limite vale entre duas datas.',
  },
];

interface BudgetFormProps {
  categories: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function BudgetForm({
  categories,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: BudgetFormProps) {
  const [kind, setKind] = useState<BudgetKindChoice>('monthly');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.success) {
      // periodStart/periodEnd são controlados de propósito — o reset abaixo
      // não os afeta, sobrevivem ao "criar mais".
      formRef.current?.reset();
      amountRef.current?.focus();
    }
    // Reage a toda mudança genuína de estado (um novo resultado de action é
    // sempre uma nova referência de objeto), não apenas a uma transição para
    // sucesso.
  }, [state]);

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
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="categoryId" className="text-muted-foreground text-sm">
            Categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={categories[0]?.id}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 flex h-11 w-full rounded-md border px-3 py-2 text-base transition-[border-color,box-shadow] duration-[var(--duration-fast)] outline-none focus-visible:ring-[3px] sm:text-sm"
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
            ref={amountRef}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            required
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-muted-foreground text-sm">Vale</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {KIND_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                'border-input bg-card hover:border-faint-foreground has-[:focus-visible]:ring-ring/20 flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-[border-color,box-shadow] duration-[var(--duration-fast)] has-[:focus-visible]:ring-[3px]',
                kind === option.value && 'border-ring',
              )}
            >
              <input
                type="radio"
                name="kind"
                aria-labelledby={`kind-${option.value}-label`}
                aria-describedby={`kind-${option.value}-hint`}
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="mt-1 h-4 w-4"
              />
              <span className="space-y-0.5">
                <span
                  id={`kind-${option.value}-label`}
                  className="block text-sm font-medium"
                >
                  {option.label}
                </span>
                <span
                  id={`kind-${option.value}-hint`}
                  className="text-muted-foreground block text-xs"
                >
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind === 'fixed' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="periodStart"
              className="text-muted-foreground text-sm"
            >
              De
            </label>
            <Input
              id="periodStart"
              name="periodStart"
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="periodEnd"
              className="text-muted-foreground text-sm"
            >
              Até
            </label>
            <Input
              id="periodEnd"
              name="periodEnd"
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              required
            />
          </div>
        </div>
      ) : null}

      <input type="hidden" name="currency" value={DEFAULT_CURRENCY} />

      {state.error ? (
        <Alert className="border-destructive/40">
          <AlertDescription className="text-destructive">
            {state.error}
          </AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais um orçamento"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Criar orçamento'}
    </Button>
  );
}
