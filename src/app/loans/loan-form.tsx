'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/loans/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface LoanFormProps {
  accounts: Array<{ id: string; name: string }>;
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function LoanForm({
  accounts,
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: LoanFormProps) {
  const [disbursementAccountId, setDisbursementAccountId] = useState(
    accounts[0]?.id ?? '',
  );
  const [repaymentAccountId, setRepaymentAccountId] = useState(
    accounts[0]?.id ?? '',
  );
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const disbursementSelectRef = useRef<HTMLSelectElement>(null);
  const repaymentSelectRef = useRef<HTMLSelectElement>(null);
  // Mantém os últimos valores conhecidos dos selects fora do ciclo de
  // render, sem entrar nas deps do efeito abaixo — atualizados em todo
  // render (sem array de deps), então já estão em dia antes do commit que
  // dispara o efeito de sucesso.
  const latestDisbursementRef = useRef(disbursementAccountId);
  const latestRepaymentRef = useRef(repaymentAccountId);
  useEffect(() => {
    latestDisbursementRef.current = disbursementAccountId;
    latestRepaymentRef.current = repaymentAccountId;
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
      if (disbursementSelectRef.current) {
        disbursementSelectRef.current.value = latestDisbursementRef.current;
      }
      if (repaymentSelectRef.current) {
        repaymentSelectRef.current.value = latestRepaymentRef.current;
      }
      descriptionRef.current?.focus();
    }
    // Reage a toda mudança genuína de estado (um novo resultado de action é
    // sempre uma nova referência de objeto), não apenas a uma transição para
    // sucesso.
  }, [state]);

  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Crie uma conta antes de criar um empréstimo.
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

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="loanDescription">
          Descrição
        </label>
        <Input
          id="loanDescription"
          name="description"
          ref={descriptionRef}
          required
          placeholder="Empréstimo pessoal"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            htmlFor="disbursementAccountId"
          >
            Conta de recebimento
          </label>
          <select
            id="disbursementAccountId"
            name="disbursementAccountId"
            ref={disbursementSelectRef}
            required
            className={FIELD_BASE_CLASSES}
            value={disbursementAccountId}
            onChange={(event) => setDisbursementAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="repaymentAccountId">
            Conta de pagamento
          </label>
          <select
            id="repaymentAccountId"
            name="repaymentAccountId"
            ref={repaymentSelectRef}
            required
            className={FIELD_BASE_CLASSES}
            value={repaymentAccountId}
            onChange={(event) => setRepaymentAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="principal">
            Valor do principal
          </label>
          <Input
            id="principal"
            name="principal"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0,00"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="monthlyInterestRate">
            Taxa de juros mensal (%)
          </label>
          <Input
            id="monthlyInterestRate"
            name="monthlyInterestRate"
            type="number"
            step="0.01"
            min="0"
            placeholder="2"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="installmentCount">
            Número de parcelas
          </label>
          <Input
            id="installmentCount"
            name="installmentCount"
            type="number"
            step="1"
            min="2"
            max="60"
            placeholder="12"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="startDate">
          Data da primeira parcela
        </label>
        <Input id="startDate" name="startDate" type="date" />
      </div>

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais um empréstimo"
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
      {pending ? 'Criando…' : 'Criar empréstimo'}
    </Button>
  );
}
