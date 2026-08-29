'use client';

import { createCategoryAction } from '@/app/categories/actions';
import { CategoryForm } from '@/app/categories/category-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

export function CreateCategoryDialog() {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Nova categoria</Button>}
      title="Nova categoria"
      description="Defina nome, descrição e cor."
      action={createCategoryAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <CategoryForm
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
