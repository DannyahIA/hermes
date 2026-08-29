'use client';

import { transferMoneyAction } from '@/app/transactions/actions';
import { TransferForm } from '@/app/transactions/transfer-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateTransferDialogProps {
  accounts: Array<{ id: string; name: string }>;
}

export function CreateTransferDialog({ accounts }: CreateTransferDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => (
        <Button variant="outline" onClick={open}>
          Transferência
        </Button>
      )}
      title="Transferência"
      description="Mova dinheiro entre suas contas."
      action={transferMoneyAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <TransferForm
          accounts={accounts}
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
