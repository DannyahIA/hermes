'use client';

import { useState, useTransition } from 'react';

import { deleteBudgetAction } from '@/app/budgets/actions';
import { Button } from '@/components/ui/button';

interface DeleteBudgetButtonProps {
  id: string;
}

/**
 * A proper Dialog component is being added in parallel by another
 * workstream and isn't available here yet — this uses a simple two-step
 * confirm state instead of inventing a modal.
 */
export function DeleteBudgetButton({ id }: DeleteBudgetButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setConfirming(true)}
      >
        Excluir
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            void deleteBudgetAction(id);
          })
        }
      >
        {isPending ? 'Excluindo...' : 'Confirmar exclusão?'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
        Cancelar
      </Button>
    </div>
  );
}
