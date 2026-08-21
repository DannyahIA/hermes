'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  type ActionResult,
  payCreditCardBillAction,
} from '@/app/accounts/actions';
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
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

interface PayBillDialogProps {
  creditAccountId: string;
  /** Current amount owed on the card — used as the default payment amount. */
  balance: number;
  /** Non-credit accounts the bill can be paid from. */
  payingAccounts: Array<{ id: string; name: string }>;
}

/**
 * Lets the user pay down a credit card's bill from one of their cash
 * accounts. Only shown on credit card account cards, and only when the
 * user has at least one non-credit account to pay from.
 */
export function PayBillDialog({
  creditAccountId,
  balance,
  payingAccounts,
}: PayBillDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    payCreditCardBillAction,
    INITIAL_STATE,
  );

  if (state.success && open) {
    setOpen(false);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Pagar fatura
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>
          <DialogTitle>Pagar fatura</DialogTitle>
          <DialogDescription>
            Escolha de qual conta o pagamento vai sair.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="creditAccountId" value={creditAccountId} />

          {state.error && (
            <Alert variant="error">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="payingAccountId">
              Pagar com
            </label>
            <select
              id="payingAccountId"
              name="payingAccountId"
              required
              className={FIELD_BASE_CLASSES}
            >
              {payingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="amount">
              Valor
            </label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={balance > 0 ? balance : undefined}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="description">
              Descrição (opcional)
            </label>
            <Input
              id="description"
              name="description"
              placeholder="Pagamento de fatura"
            />
          </div>

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
      {pending ? 'Pagando…' : 'Confirmar pagamento'}
    </Button>
  );
}
