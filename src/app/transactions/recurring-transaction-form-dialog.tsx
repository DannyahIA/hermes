'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { createRecurringTransactionAction } from '@/app/transactions/recurring-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  CreateDialogForm,
  RepeatToggle,
} from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
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
  return (
    <CreateDialogForm
      trigger={(open) => (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={open}
        >
          Nova recorrência
        </Button>
      )}
      title="Nova transação recorrente"
      description="Ex: salário no primeiro dia útil, internet todo dia 8."
      action={createRecurringTransactionAction}
      initialState={INITIAL_STATE}
    >
      {({ state, formAction, repeating, onRepeatingChange, close }) => (
        <RecurringTransactionForm
          accounts={accounts}
          categories={categories}
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

interface RecurringTransactionFormProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

function RecurringTransactionForm({
  accounts,
  categories,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: RecurringTransactionFormProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [dayRuleKind, setDayRuleKind] = useState<
    'fixed_day' | 'first_business_day' | 'last_business_day'
  >('fixed_day');
  const [dayRuleDay, setDayRuleDay] = useState('');
  const [startDate, setStartDate] = useState(today());

  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const accountSelectRef = useRef<HTMLSelectElement>(null);
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  const dayRuleKindSelectRef = useRef<HTMLSelectElement>(null);

  // Mantém os últimos valores conhecidos dos <select>s retidos (tipo, conta,
  // categoria, regra de repetição) fora do ciclo de render, atualizados em
  // todo render (sem array de deps) — já estão em dia antes do commit que
  // dispara o efeito de sucesso abaixo. dayRuleDay/startDate não precisam
  // disso: são <input> controlados (número/data), e React já resincroniza o
  // valor a cada render — só o reset nativo de um <select> (que volta para o
  // atributo `selected`) escapa do controle do React e precisa ser
  // restaurado à mão.
  const latestTypeRef = useRef(type);
  const latestAccountIdRef = useRef(accountId);
  const latestCategoryIdRef = useRef(categoryId);
  const latestDayRuleKindRef = useRef(dayRuleKind);
  useEffect(() => {
    latestTypeRef.current = type;
    latestAccountIdRef.current = accountId;
    latestCategoryIdRef.current = categoryId;
    latestDayRuleKindRef.current = dayRuleKind;
  });

  useEffect(() => {
    if (state.success) {
      // conta/categoria/tipo/regra de repetição/dia do mês/data de início
      // são controlados de propósito e devem sobreviver ao "criar mais" (ver
      // tabela de retenção no spec). React reseta os campos nativamente ao
      // concluir uma form action com sucesso, o que devolveria os <select>
      // controlados ao atributo `selected` no DOM — por isso seus valores
      // são reaplicados a partir do estado do React logo abaixo. O resto
      // (descrição, valor) é sempre limpo pelo reset nativo.
      formRef.current?.reset();
      if (typeSelectRef.current) {
        typeSelectRef.current.value = latestTypeRef.current;
      }
      if (accountSelectRef.current) {
        accountSelectRef.current.value = latestAccountIdRef.current;
      }
      if (categorySelectRef.current) {
        categorySelectRef.current.value = latestCategoryIdRef.current;
      }
      if (dayRuleKindSelectRef.current) {
        dayRuleKindSelectRef.current.value = latestDayRuleKindRef.current;
      }
      descriptionRef.current?.focus();
    }
    // Reage a toda mudança genuína de estado (um novo resultado de action é
    // sempre uma nova referência de objeto), não apenas a uma transição para
    // sucesso.
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="error">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="recurring-description">
          Descrição
        </label>
        <Input
          id="recurring-description"
          name="description"
          ref={descriptionRef}
          required
          placeholder="Salário"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recurring-type">
            Tipo
          </label>
          <select
            id="recurring-type"
            name="type"
            ref={typeSelectRef}
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
          <label className="text-sm font-medium" htmlFor="recurring-amount">
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
          <label className="text-sm font-medium" htmlFor="recurring-accountId">
            Conta
          </label>
          <select
            id="recurring-accountId"
            name="accountId"
            ref={accountSelectRef}
            required
            className={FIELD_BASE_CLASSES}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recurring-categoryId">
            Categoria
          </label>
          <select
            id="recurring-categoryId"
            name="categoryId"
            ref={categorySelectRef}
            className={FIELD_BASE_CLASSES}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
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
        <label className="text-sm font-medium" htmlFor="recurring-dayRuleKind">
          Repete
        </label>
        <select
          id="recurring-dayRuleKind"
          name="dayRuleKind"
          ref={dayRuleKindSelectRef}
          required
          className={FIELD_BASE_CLASSES}
          value={dayRuleKind}
          onChange={(event) =>
            setDayRuleKind(
              event.target.value as
                'fixed_day' | 'first_business_day' | 'last_business_day',
            )
          }
        >
          <option value="fixed_day">Todo dia fixo do mês</option>
          <option value="first_business_day">Primeiro dia útil do mês</option>
          <option value="last_business_day">Último dia útil do mês</option>
        </select>
      </div>

      {dayRuleKind === 'fixed_day' && (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recurring-dayRuleDay">
            Dia do mês
          </label>
          <Input
            id="recurring-dayRuleDay"
            name="dayRuleDay"
            type="number"
            min="1"
            max="31"
            value={dayRuleDay}
            onChange={(event) => setDayRuleDay(event.target.value)}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recurring-startDate">
            Começa em
          </label>
          <Input
            id="recurring-startDate"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="recurring-endDate">
            Termina em (opcional)
          </label>
          <Input id="recurring-endDate" name="endDate" type="date" />
        </div>
      </div>

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma recorrência"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton />
        </div>
      </DialogFooter>
    </form>
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
