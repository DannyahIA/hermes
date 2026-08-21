'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult, createAccountAction } from '@/app/accounts/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  type AccountType,
  DEFAULT_CURRENCY,
} from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

export function AccountForm() {
  const [type, setType] = useState<AccountType>('checking');
  const [state, formAction] = useActionState(
    createAccountAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="name">
          Nome da conta
        </label>
        <Input id="name" name="name" required placeholder="Conta corrente" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            required
            className={FIELD_BASE_CLASSES}
            value={type}
            onChange={(event) => setType(event.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((accountType) => (
              <option key={accountType} value={accountType}>
                {ACCOUNT_TYPE_LABELS[accountType]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="balance">
            Saldo inicial
          </label>
          <Input
            id="balance"
            name="balance"
            type="number"
            step="0.01"
            defaultValue={0}
          />
        </div>
      </div>

      {type === 'credit' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="closingDay">
              Dia de fechamento
            </label>
            <Input
              id="closingDay"
              name="closingDay"
              type="number"
              min="1"
              max="28"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dueDay">
              Dia de vencimento
            </label>
            <Input id="dueDay" name="dueDay" type="number" min="1" max="28" />
          </div>
        </div>
      )}

      <input type="hidden" name="currency" value={DEFAULT_CURRENCY} />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? 'Criando…' : 'Criar conta'}
    </Button>
  );
}
