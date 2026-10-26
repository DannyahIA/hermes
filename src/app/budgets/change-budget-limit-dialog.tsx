'use client';

import { useFormStatus } from 'react-dom';

import {
  type ActionResult,
  changeBudgetLimitAction,
} from '@/app/budgets/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DialogForm } from '@/components/ui/dialog-form';
import { Input } from '@/components/ui/input';
import { toast } from '@/shared/hooks/use-toast';

const INITIAL_STATE: ActionResult = { success: false };

interface ChangeBudgetLimitDialogProps {
  budgetId: string;
  name: string;
  /** The limit today, offered as the starting value. */
  amount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One field: the budget's new limit. The page revalidates on success. */
export function ChangeBudgetLimitDialog({
  budgetId,
  name,
  amount,
  open,
  onOpenChange,
}: ChangeBudgetLimitDialogProps) {
  async function change(
    _state: ActionResult,
    formData: FormData,
  ): Promise<ActionResult> {
    return changeBudgetLimitAction(budgetId, Number(formData.get('amount')));
  }

  return (
    <DialogForm
      open={open}
      onOpenChange={onOpenChange}
      action={change}
      initialState={INITIAL_STATE}
      onSuccess={() => toast({ title: 'Limite alterado.', variant: 'success' })}
    >
      {({ state, formAction }) => (
        <>
          <DialogHeader>
            <DialogTitle>Alterar limite</DialogTitle>
            <DialogDescription>
              {`Novo limite de ${name}. Num orçamento de todo mês, vale a partir deste mês.`}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            {state.error ? (
              <Alert variant="error">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor={`limit-${budgetId}`}
                className="text-muted-foreground text-sm"
              >
                Novo limite
              </label>
              <Input
                id={`limit-${budgetId}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={amount}
                required
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <SubmitButton />
            </DialogFooter>
          </form>
        </>
      )}
    </DialogForm>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar'}
    </Button>
  );
}
