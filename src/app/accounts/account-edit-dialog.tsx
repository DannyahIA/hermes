'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult, updateAccountAction } from '@/app/accounts/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  type AccountType,
} from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

interface AccountEditDialogProps {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  closingDay?: number;
  dueDay?: number;
}

/**
 * The one editing surface for an account's non-balance details (name,
 * type, currency, and — for credit cards — closing/due day). `balance` is
 * never editable here, per domain.md's Single Source of Truth rule.
 */
export function AccountEditDialog({
  id,
  name,
  type: initialType,
  currency,
  closingDay,
  dueDay,
}: AccountEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AccountType>(initialType);
  const [state, formAction] = useActionState(
    updateAccountAction,
    INITIAL_STATE,
  );

  if (state.success && open) {
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Editar conta</DialogTitle>
          <DialogDescription>
            Altere o nome, o tipo ou os dados do cartão de crédito.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="currency" value={currency} />

          {state.error && (
            <Alert variant="error">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-name">
              Nome da conta
            </label>
            <Input id="edit-name" name="name" defaultValue={name} required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-type">
              Tipo
            </label>
            <select
              id="edit-type"
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

          {type === 'credit' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="edit-closingDay"
                >
                  Dia de fechamento
                </label>
                <Input
                  id="edit-closingDay"
                  name="closingDay"
                  type="number"
                  min="1"
                  max="28"
                  defaultValue={closingDay}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="edit-dueDay">
                  Dia de vencimento
                </label>
                <Input
                  id="edit-dueDay"
                  name="dueDay"
                  type="number"
                  min="1"
                  max="28"
                  defaultValue={dueDay}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar alterações'}
    </Button>
  );
}
