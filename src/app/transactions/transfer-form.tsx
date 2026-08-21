'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  type ActionResult,
  transferMoneyAction,
} from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

interface TransferFormProps {
  accounts: Array<{ id: string; name: string }>;
}

export function TransferForm({ accounts }: TransferFormProps) {
  const [state, formAction] = useActionState(
    transferMoneyAction,
    INITIAL_STATE,
  );

  if (accounts.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Você precisa de pelo menos duas contas para transferir dinheiro entre
        elas.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fromAccountId">
            De
          </label>
          <select
            id="fromAccountId"
            name="fromAccountId"
            required
            className={FIELD_BASE_CLASSES}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="toAccountId">
            Para
          </label>
          <select
            id="toAccountId"
            name="toAccountId"
            required
            className={FIELD_BASE_CLASSES}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="transferAmount">
          Valor
        </label>
        <Input
          id="transferAmount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="transferDescription">
          Descrição
        </label>
        <Input
          id="transferDescription"
          name="description"
          required
          placeholder="Transferência para poupança"
        />
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? 'Transferindo…' : 'Transferir'}
    </Button>
  );
}
