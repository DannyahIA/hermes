'use client';

import { useTransition } from 'react';

import { deleteBudgetAction } from '@/app/budgets/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';

interface DeleteBudgetButtonProps {
  id: string;
}

export function DeleteBudgetButton({ id }: DeleteBudgetButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBudgetAction(id);
      toast(
        result.success
          ? { title: 'Orçamento excluído.', variant: 'success' }
          : {
              title: result.error ?? 'Não foi possível excluir.',
              variant: 'error',
            },
      );
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? 'Excluindo…' : 'Excluir'}
        </Button>
      }
      title="Excluir orçamento"
      description="Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita."
      onConfirm={handleDelete}
    />
  );
}
