'use client';

import { useState, useTransition } from 'react';

import { deleteCategoryAction } from '@/app/categories/actions';
import { Button } from '@/components/ui/button';

interface DeleteCategoryButtonProps {
  categoryId: string;
}

/**
 * No modal system exists yet (a `Dialog` component is landing in a parallel
 * workstream), so this uses a simple two-step confirm: the first click arms
 * the button, the second click within the same render actually deletes.
 */
export function DeleteCategoryButton({
  categoryId,
}: DeleteCategoryButtonProps) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(categoryId);
      if (!result.success) {
        setError(result.error ?? 'Não foi possível excluir esta categoria.');
        setArmed(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        onBlur={() => setArmed(false)}
      >
        {isPending ? 'Excluindo...' : armed ? 'Confirmar exclusão' : 'Excluir'}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
