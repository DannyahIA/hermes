'use client';

import { createLoanAction } from '@/app/loans/actions';
import { LoanForm } from '@/app/loans/loan-form';
import { Button } from '@/components/ui/button';
import { CreateDialogForm } from '@/components/ui/create-dialog-form';

const INITIAL_STATE = { success: false };

interface CreateLoanDialogProps {
  accounts: Array<{ id: string; name: string }>;
}

export function CreateLoanDialog({ accounts }: CreateLoanDialogProps) {
  return (
    <CreateDialogForm
      trigger={(open) => <Button onClick={open}>Novo empréstimo</Button>}
      title="Novo empréstimo"
      description="Escolha as contas de recebimento e pagamento, o valor e a taxa de juros mensal."
      action={createLoanAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <LoanForm
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
