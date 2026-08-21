'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { createRecurringTransactionAction } from '@/app/transactions/recurring-actions';
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
import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

interface RecurringTransactionFormDialogProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecurringTransactionFormDialog({
  accounts,
  categories,
}: RecurringTransactionFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [dayRuleKind, setDayRuleKind] = useState<
    'fixed_day' | 'first_business_day' | 'last_business_day'
  >('fixed_day');

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Nova recorrência
      </Button>
      <DialogForm
        open={open}
        onOpenChange={setOpen}
        action={createRecurringTransactionAction}
        initialState={INITIAL_STATE}
        onSuccess={() => setDayRuleKind('fixed_day')}
      >
        {({ state, formAction }) => (
          <>
            <DialogHeader>
              <DialogTitle>Nova transação recorrente</DialogTitle>
              <DialogDescription>
                Ex: salário no primeiro dia útil, internet todo dia 8.
              </DialogDescription>
            </DialogHeader>

            <form action={formAction} className="space-y-4">
              {state.error && (
                <Alert variant="error">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-description"
                >
                  Descrição
                </label>
                <Input
                  id="recurring-description"
                  name="description"
                  required
                  placeholder="Salário"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-type"
                  >
                    Tipo
                  </label>
                  <select
                    id="recurring-type"
                    name="type"
                    required
                    className={FIELD_BASE_CLASSES}
                    defaultValue="expense"
                  >
                    <option value="expense">
                      {TRANSACTION_TYPE_LABELS.expense}
                    </option>
                    <option value="income">
                      {TRANSACTION_TYPE_LABELS.income}
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-amount"
                  >
                    Valor
                  </label>
                  <Input
                    id="recurring-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-accountId"
                  >
                    Conta
                  </label>
                  <select
                    id="recurring-accountId"
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
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-categoryId"
                  >
                    Categoria
                  </label>
                  <select
                    id="recurring-categoryId"
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
                <label
                  className="text-sm font-medium"
                  htmlFor="recurring-dayRuleKind"
                >
                  Repete
                </label>
                <select
                  id="recurring-dayRuleKind"
                  name="dayRuleKind"
                  required
                  className={FIELD_BASE_CLASSES}
                  value={dayRuleKind}
                  onChange={(event) =>
                    setDayRuleKind(
                      event.target.value as
                        | 'fixed_day'
                        | 'first_business_day'
                        | 'last_business_day',
                    )
                  }
                >
                  <option value="fixed_day">Todo dia fixo do mês</option>
                  <option value="first_business_day">
                    Primeiro dia útil do mês
                  </option>
                  <option value="last_business_day">
                    Último dia útil do mês
                  </option>
                </select>
              </div>

              {dayRuleKind === 'fixed_day' && (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-dayRuleDay"
                  >
                    Dia do mês
                  </label>
                  <Input
                    id="recurring-dayRuleDay"
                    name="dayRuleDay"
                    type="number"
                    min="1"
                    max="31"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-startDate"
                  >
                    Começa em
                  </label>
                  <Input
                    id="recurring-startDate"
                    name="startDate"
                    type="date"
                    defaultValue={today()}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="recurring-endDate"
                  >
                    Termina em (opcional)
                  </label>
                  <Input id="recurring-endDate" name="endDate" type="date" />
                </div>
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
          </>
        )}
      </DialogForm>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Criar recorrência'}
    </Button>
  );
}
