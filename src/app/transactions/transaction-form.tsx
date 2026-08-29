'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TRANSACTION_TYPE_LABELS } from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { formatCurrency } from '@/shared/lib/format-currency';

interface TransactionFormProps {
  accounts: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({
  accounts,
  categories,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: TransactionFormProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [occurredAt, setOccurredAt] = useState(today());
  const [installments, setInstallments] = useState(false);
  const [amountMode, setAmountMode] = useState<'total' | 'installment'>(
    'total',
  );
  const [amountValue, setAmountValue] = useState('');
  const [installmentCountValue, setInstallmentCountValue] = useState(2);

  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const typeSelectRef = useRef<HTMLSelectElement>(null);
  const accountSelectRef = useRef<HTMLSelectElement>(null);
  const categorySelectRef = useRef<HTMLSelectElement>(null);

  // Mantém os últimos valores conhecidos dos <select>s retidos (tipo,
  // conta, categoria) fora do ciclo de render, sem entrar nas deps do
  // efeito abaixo — atualizados em todo render (sem array de deps), então
  // já estão em dia antes do commit que dispara o efeito de sucesso. `data`
  // não precisa disso: é um `<input type="date">` controlado, e React já
  // resincroniza `defaultValue` em inputs da família texto/data a cada
  // render — só o reset nativo de um <select> (que volta para o atributo
  // `selected`) escapa do controle do React e precisa ser restaurado à mão.
  const latestTypeRef = useRef(type);
  const latestAccountIdRef = useRef(accountId);
  const latestCategoryIdRef = useRef(categoryId);
  useEffect(() => {
    latestTypeRef.current = type;
    latestAccountIdRef.current = accountId;
    latestCategoryIdRef.current = categoryId;
  });

  // Campos controlados que são sempre limpos (descrição fica de fora — é
  // uncontrolled, o reset nativo do form já cuida dela) são resetados
  // ajustando o state durante a renderização (padrão oficialmente suportado
  // pelo React para reagir a uma prop que mudou sem um efeito extra),
  // comparando com o `state` do render anterior. As mutações de DOM (reset
  // do form, restaurar os selects controlados, focar a descrição) não podem
  // entrar neste mesmo bloco — a lint deste repo proíbe escrever em `.current`
  // de um ref durante a renderização — por isso ficam num `useEffect`
  // separado, logo abaixo.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success) {
      setAmountValue('');
      setInstallments(false);
      setAmountMode('total');
      setInstallmentCountValue(2);
    }
  }

  useEffect(() => {
    if (state.success) {
      // tipo/conta/categoria/data são controlados de propósito e devem
      // sobreviver ao "criar mais" (ver tabela de retenção no spec). React
      // reseta os campos nativamente ao concluir uma form action com
      // sucesso, o que devolveria os <select> controlados (tipo/conta/
      // categoria) ao atributo `selected` no DOM — por isso seus valores
      // são reaplicados a partir do estado do React logo abaixo. `data`
      // não precisa da mesma restauração (ver comentário acima, junto aos
      // refs). O resto (descrição, valor, parcelamento) é sempre limpo.
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
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
          <input
            type="hidden"
            name="installments"
            value={String(installments && type === 'expense')}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Descrição
        </label>
        <Input
          id="description"
          name="description"
          ref={descriptionRef}
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
          <label className="text-sm font-medium" htmlFor="categoryId">
            Categoria
          </label>
          <select
            id="categoryId"
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
        <label className="text-sm font-medium" htmlFor="occurredAt">
          Data
        </label>
        <Input
          id="occurredAt"
          name="occurredAt"
          type="date"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
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

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma transação"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <SubmitButton installments={installments && type === 'expense'} />
        </div>
      </DialogFooter>
    </form>
  );
}

function SubmitButton({ installments }: { installments: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? 'Salvando…'
        : installments
          ? 'Registrar parcelamento'
          : 'Registrar transação'}
    </Button>
  );
}
