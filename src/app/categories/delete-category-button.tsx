'use client';

import { useTransition } from 'react';

import { deleteCategoryAction } from '@/app/categories/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/shared/hooks/use-toast';

interface DeleteCategoryButtonProps {
  categoryId: string;
}

export function DeleteCategoryButton({
  categoryId,
}: DeleteCategoryButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);
      toast(
        result.success
          ? { title: 'Categoria excluída.', variant: 'success' }
          : {
              title: result.error ?? 'Não foi possível excluir esta categoria.',
              variant: 'error',
            },
      );
    });
  }

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
        >
          {isPending ? 'Excluindo…' : 'Excluir'}
        </Button>
      }
      title="Excluir categoria"
      description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
      onConfirm={handleDelete}
    />
  );
}
