'use client';

import { createBudgetAction } from '@/app/budgets/actions';
import { BudgetForm } from '@/app/budgets/budget-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateBudgetDialogProps {
  categories: Array<{ id: string; name: string }>;
}

export function CreateBudgetDialog({ categories }: CreateBudgetDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Novo orçamento</Button>}
      title="Novo orçamento"
      description="Escolha a categoria, o valor limite e o período."
      action={createBudgetAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <BudgetForm
          categories={categories}
          state={state}
          formAction={formAction}
          repeating={repeating}
          onRepeatingChange={onRepeatingChange}
          onCancel={close}
        />
      )}
    </CreateDialogForm>
  );
}
