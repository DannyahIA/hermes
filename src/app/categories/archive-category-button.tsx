'use client';

import { useState, useTransition } from 'react';

import { archiveCategoryAction } from '@/app/categories/actions';
import { Button } from '@/components/ui/button';

interface ArchiveCategoryButtonProps {
  categoryId: string;
  archived: boolean;
}

export function ArchiveCategoryButton({
  categoryId,
  archived,
}: ArchiveCategoryButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await archiveCategoryAction(categoryId, !archived);
      if (!result.success) {
        setError(result.error ?? 'Não foi possível atualizar esta categoria.');
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? 'Aguarde...' : archived ? 'Reativar' : 'Arquivar'}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
