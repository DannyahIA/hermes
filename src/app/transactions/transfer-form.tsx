'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/transactions/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface TransferFormProps {
  accounts: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function TransferForm({
  accounts,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: TransferFormProps) {
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(
    accounts[1]?.id ?? accounts[0]?.id ?? '',
  );
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const fromSelectRef = useRef<HTMLSelectElement>(null);
  const toSelectRef = useRef<HTMLSelectElement>(null);
  // Mantém os últimos valores conhecidos dos selects fora do ciclo de
  // render, sem entrar nas deps do efeito abaixo — atualizados em todo
  // render (sem array de deps), então já estão em dia antes do commit que
  // dispara o efeito de sucesso.
  const latestFromRef = useRef(fromAccountId);
  const latestToRef = useRef(toAccountId);
  useEffect(() => {
    latestFromRef.current = fromAccountId;
    latestToRef.current = toAccountId;
  });

  useEffect(() => {
    if (state.success) {
      // As contas são controladas de propósito e devem sobreviver ao "criar
      // mais" (ver tabela de retenção no spec). React reseta os campos
      // nativamente ao concluir uma form action com sucesso, o que devolveria
      // os <select> controlados à primeira opção — por isso os valores são
      // reaplicados a partir do estado do React (não do DOM, que a essa
      // altura já pode estar corrompido pelo reset nativo).
      formRef.current?.reset();
      if (fromSelectRef.current) {
        fromSelectRef.current.value = latestFromRef.current;
      }
      if (toSelectRef.current) {
        toSelectRef.current.value = latestToRef.current;
      }
      amountRef.current?.focus();
    }
    // Reage a toda mudança genuína de estado (um novo resultado de action é
    // sempre uma nova referência de objeto), não apenas a uma transição para
    // sucesso.
  }, [state]);

  if (accounts.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Você precisa de pelo menos duas contas para transferir dinheiro entre
        elas.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
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
            ref={fromSelectRef}
            required
            className={FIELD_BASE_CLASSES}
            value={fromAccountId}
            onChange={(event) => setFromAccountId(event.target.value)}
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
            ref={toSelectRef}
            required
            className={FIELD_BASE_CLASSES}
            value={toAccountId}
            onChange={(event) => setToAccountId(event.target.value)}
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
          ref={amountRef}
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

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma transferência"
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
      {pending ? 'Transferindo…' : 'Transferir'}
    </Button>
  );
}
