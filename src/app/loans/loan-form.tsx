'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult, createLoanAction } from '@/app/loans/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

const INITIAL_STATE: ActionResult = { success: false };

interface LoanFormProps {
  accounts: Array<{ id: string; name: string }>;
}

export function LoanForm({ accounts }: LoanFormProps) {
  const [state, formAction] = useActionState(createLoanAction, INITIAL_STATE);

  if (accounts.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Crie uma conta antes de criar um empréstimo.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
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
          <label className="text-sm font-medium" htmlFor="repaymentAccountId">
            Conta de pagamento
          </label>
          <select
            id="repaymentAccountId"
            name="repaymentAccountId"
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

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" type="submit" disabled={pending}>
      {pending ? 'Criando…' : 'Criar empréstimo'}
    </Button>
  );
}
