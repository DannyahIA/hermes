'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import {
  type ActionResult,
  createInstallmentAction,
  createTransactionAction,
} from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { formatCurrency } from '@/shared/lib/format-currency';

const INITIAL_STATE: ActionResult = { success: false };

interface TransactionFormProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({
  accounts,
  categories,
}: TransactionFormProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [installments, setInstallments] = useState(false);
  const [amountMode, setAmountMode] = useState<'total' | 'installment'>(
    'total',
  );
  const [amountValue, setAmountValue] = useState('');
  const [installmentCountValue, setInstallmentCountValue] = useState(2);

  // Parceling only makes sense for an expense — switch the form's action
  // (and therefore which use-case runs) instead of branching inside one
  // action, keeping each server action's job single-purpose.
  const action =
    installments && type === 'expense'
      ? createInstallmentAction
      : createTransactionAction;
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  // Making `amount`/`installmentCount` controlled inputs defeats React 19's
  // automatic reset of *uncontrolled* fields after a successful submit —
  // reset them manually. This is React's "adjusting state during render"
  // pattern (setState during render, guarded by a ref-of-previous-state
  // comparison) rather than an effect, so it happens before paint and
  // reacts to every genuine state change (a fresh action result is always a
  // new object reference) — not just a transition into `success`, so a
  // second successful submit in a row still resets.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setAmountValue('');
      setInstallmentCountValue(2);
    }
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
          <label className="text-sm font-medium" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            required
            className={FIELD_BASE_CLASSES}
            value={type}
            onChange={(event) =>
              setType(event.target.value as 'expense' | 'income')
            }
          >
            <option value="expense">{TRANSACTION_TYPE_LABELS.expense}</option>
            <option value="income">{TRANSACTION_TYPE_LABELS.income}</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" htmlFor="amount">
              {installments && type === 'expense'
                ? amountMode === 'total'
                  ? 'Valor total'
                  : 'Valor da parcela'
                : 'Valor'}
            </label>
            {installments && type === 'expense' && (
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAmountMode('total')}
                  className={`rounded-full border px-2 py-0.5 ${amountMode === 'total' ? 'border-primary bg-primary/10' : 'border-input'}`}
                >
                  Total
                </button>
                <button
                  type="button"
                  onClick={() => setAmountMode('installment')}
                  className={`rounded-full border px-2 py-0.5 ${amountMode === 'installment' ? 'border-primary bg-primary/10' : 'border-input'}`}
                >
                  Por parcela
                </button>
              </div>
            )}
          </div>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amountValue}
            onChange={(event) => setAmountValue(event.target.value)}
          />
          {installments && type === 'expense' && amountValue && (
            <p className="text-muted-foreground text-xs">
              {amountMode === 'total'
                ? `≈ ${formatCurrency(Number(amountValue) / installmentCountValue)} por parcela`
                : `≈ ${formatCurrency(Number(amountValue) * installmentCountValue)} no total`}
            </p>
          )}
          {installments && type === 'expense' && (
            <input type="hidden" name="amountMode" value={amountMode} />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Descrição
        </label>
        <Input
          id="description"
          name="description"
          required
          placeholder="Supermercado"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="accountId">
            Conta
          </label>
          <select
            id="accountId"
            name="accountId"
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
          <label className="text-sm font-medium" htmlFor="categoryId">
            Categoria
          </label>
          <select
            id="categoryId"
            name="categoryId"
            className={FIELD_BASE_CLASSES}
          >
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="occurredAt">
          Data
        </label>
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          defaultValue={today()}
          required
        />
      </div>

      {type === 'expense' && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={installments}
              onChange={(event) => setInstallments(event.target.checked)}
              className="border-input h-4 w-4 rounded"
            />
            Parcelar
          </label>
          {installments && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="installmentCount">
                Número de parcelas
              </label>
              <Input
                id="installmentCount"
                name="installmentCount"
                type="number"
                min="2"
                max="60"
                step="1"
                value={installmentCountValue}
                onChange={(event) =>
                  setInstallmentCountValue(Number(event.target.value) || 2)
                }
                required
              />
            </div>
          )}
        </div>
      )}

      <SubmitButton installments={installments && type === 'expense'} />
    </form>
  );
}

function SubmitButton({ installments }: { installments: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending
        ? 'Salvando…'
        : installments
          ? 'Registrar parcelamento'
          : 'Registrar transação'}
    </Button>
  );
}
