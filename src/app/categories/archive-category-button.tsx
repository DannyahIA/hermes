'use client';

import { useTransition } from 'react';

import { archiveCategoryAction } from '@/app/categories/actions';
import { Button } from '@/components/ui/button';
import { toast } from '@/shared/hooks/use-toast';

interface ArchiveCategoryButtonProps {
  categoryId: string;
  archived: boolean;
}

export function ArchiveCategoryButton({
  categoryId,
  archived,
}: ArchiveCategoryButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await archiveCategoryAction(categoryId, !archived);
      toast(
        result.success
          ? {
              title: archived ? 'Categoria reativada.' : 'Categoria arquivada.',
              variant: 'success',
            }
          : {
              title:
                result.error ?? 'Não foi possível atualizar esta categoria.',
              variant: 'error',
            },
      );
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? 'Aguarde…' : archived ? 'Reativar' : 'Arquivar'}
    </Button>
  );
}
