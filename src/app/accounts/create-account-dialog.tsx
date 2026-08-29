'use client';

import { AccountForm } from '@/app/accounts/account-form';
import { createAccountAction } from '@/app/accounts/actions';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

export function CreateAccountDialog() {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Nova conta</Button>}
      title="Nova conta"
      description="Adicione uma conta financeira."
      action={createAccountAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <AccountForm
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
