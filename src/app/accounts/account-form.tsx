'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { type ActionResult } from '@/app/accounts/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RepeatToggle } from '@/components/ui/create-dialog-form';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES,
  type AccountType,
  DEFAULT_CURRENCY,
} from '@/config/constants';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';

interface AccountFormProps {
  state: ActionResult;
  formAction: (formData: FormData) => void;
  repeating: boolean;
  onRepeatingChange: (repeating: boolean) => void;
  onCancel: () => void;
}

export function AccountForm({
  state,
  formAction,
  repeating,
  onRepeatingChange,
  onCancel,
}: AccountFormProps) {
  const [type, setType] = useState<AccountType>('checking');
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLSelectElement>(null);
  // Mantém o último `type` conhecido fora do ciclo de render, sem entrar nas
  // deps do efeito abaixo — se entrasse, qualquer troca de tipo depois de um
  // envio bem-sucedido (com "criar mais" ligado) refocaria o campo nome à
  // toa. Atualizado em todo render (sem array de deps), então já está em
  // dia antes do commit que dispara o efeito de sucesso.
  const latestTypeRef = useRef(type);
  useEffect(() => {
    latestTypeRef.current = type;
  });

  useEffect(() => {
    if (state.success) {
      // `type` é controlado de propósito e deve sobreviver ao "criar mais"
      // (ver tabela de retenção no spec). React reseta os campos nativamente
      // ao concluir uma form action com sucesso, o que devolveria o
      // <select> controlado à primeira opção — por isso o valor é
      // reaplicado a partir do estado do React (não do DOM, que a essa
      // altura já pode estar corrompido pelo reset nativo).
      formRef.current?.reset();
      if (typeRef.current) {
        typeRef.current.value = latestTypeRef.current;
      }
      nameRef.current?.focus();
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
        <label className="text-sm font-medium" htmlFor="name">
          Nome da conta
        </label>
        <Input
          id="name"
          name="name"
          ref={nameRef}
          required
          placeholder="Conta corrente"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="type">
            Tipo
          </label>
          <select
            id="type"
            name="type"
            ref={typeRef}
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
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="balance">
            Saldo inicial
          </label>
          <Input
            id="balance"
            name="balance"
            type="number"
            step="0.01"
            defaultValue={0}
          />
        </div>
      </div>

      {type === 'credit' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="closingDay">
              Dia de fechamento
            </label>
            <Input
              id="closingDay"
              name="closingDay"
              type="number"
              min="1"
              max="28"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dueDay">
              Dia de vencimento
            </label>
            <Input id="dueDay" name="dueDay" type="number" min="1" max="28" />
          </div>
        </div>
      )}

      <input type="hidden" name="currency" value={DEFAULT_CURRENCY} />

      <DialogFooter className="items-center justify-between sm:justify-between">
        <RepeatToggle
          checked={repeating}
          onChange={onRepeatingChange}
          label="Criar mais uma conta"
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
      {pending ? 'Criando…' : 'Criar conta'}
    </Button>
  );
}
