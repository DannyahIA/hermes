'use client';

import { Ellipsis } from 'lucide-react';
import { useState, useTransition } from 'react';

import {
  type ActionResult,
  archiveCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from '@/app/categories/actions';
import { RenameForm } from '@/app/categories/category-rename-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DialogForm } from '@/components/ui/dialog-form';
import { Menu, MenuItem } from '@/components/ui/menu';
import { toast } from '@/shared/hooks/use-toast';

const INITIAL_STATE: ActionResult = { success: false };

interface CategoryRowMenuProps {
  id: string;
  name: string;
  color?: string;
  archived: boolean;
}

/**
 * The actions for one category, in its row of the list. Archived
 * categories can be restored; both kinds can be deleted, after a
 * confirmation.
 */
export function CategoryRowMenu({
  id,
  name,
  color,
  archived,
}: CategoryRowMenuProps) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();

  function setArchived(next: boolean) {
    startTransition(async () => {
      const result = await archiveCategoryAction(id, next);
      toast(
        result.success
          ? {
              title: next ? 'Categoria arquivada.' : 'Categoria reativada.',
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

  async function remove() {
    const result = await deleteCategoryAction(id);
    toast(
      result.success
        ? { title: 'Categoria excluída.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir esta categoria.',
            variant: 'error',
          },
    );
  }

  return (
    <>
      <Menu
        label={`Ações de ${name}`}
        trigger={<Ellipsis aria-hidden className="size-4" />}
        triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring aria-expanded:bg-accent inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {archived ? (
          <MenuItem onSelect={() => setArchived(false)}>Reativar</MenuItem>
        ) : (
          <>
            <MenuItem onSelect={() => setRenaming(true)}>
              Renomear e cor
            </MenuItem>
            <MenuItem onSelect={() => setArchived(true)}>Arquivar</MenuItem>
          </>
        )}
        <MenuItem destructive onSelect={() => setDeleting(true)}>
          Excluir
        </MenuItem>
      </Menu>

      <DialogForm
        open={renaming}
        onOpenChange={setRenaming}
        action={updateCategoryAction}
        initialState={INITIAL_STATE}
        onSuccess={() =>
          toast({ title: 'Categoria atualizada.', variant: 'success' })
        }
      >
        {({ state, formAction }) => (
          <RenameForm
            id={id}
            name={name}
            color={color}
            state={state}
            formAction={formAction}
            onCancel={() => setRenaming(false)}
          />
        )}
      </DialogForm>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir categoria"
        description="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        onConfirm={remove}
      />
    </>
  );
}
