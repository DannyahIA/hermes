'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { parseAmount } from '@/modules/capture/domain/parse-amount';
import { FIELD_BASE_CLASSES } from '@/shared/constants/field-styles';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';

import { discardCaptureAction, provideCaptureAmountAction } from './actions';

export interface PendingCaptureView {
  id: string;
  /** "Padaria Real", or "Compra no Nubank". */
  description: string;
  cardName: string;
  /** "Hoje às 12:41" */
  when: string;
  /** "R$ 23,90"; null when it came without one. */
  amount: string | null;
  status: 'needs_account' | 'needs_amount';
}

/** Payments the shortcut sent that still miss their amount or their card's account. */
export function PendingCaptures({
  captures,
}: {
  captures: PendingCaptureView[];
}) {
  return (
    <ul>
      {captures.map((capture) => (
        <PendingCaptureRow key={capture.id} capture={capture} />
      ))}
    </ul>
  );
}

function PendingCaptureRow({ capture }: { capture: PendingCaptureView }) {
  const [amount, setAmount] = useState('');
  const [isPending, startTransition] = useTransition();

  function record(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      toast({ title: 'Escreva o valor, como 23,90.', variant: 'error' });
      return;
    }
    startTransition(async () => {
      const result = await provideCaptureAmountAction({
        captureId: capture.id,
        amount: value,
      });
      if (!result.success) {
        toast({ title: result.error, variant: 'error' });
        return;
      }
      toast({
        title: result.recorded
          ? `${capture.description} registrada.`
          : `Valor salvo. Falta escolher a conta do cartão ${capture.cardName}.`,
        variant: 'success',
      });
    });
  }

  function discard() {
    startTransition(async () => {
      const result = await discardCaptureAction(capture.id);
      toast(
        result.success
          ? { title: `${capture.description} descartada.`, variant: 'success' }
          : { title: result.error, variant: 'error' },
      );
    });
  }

  const inputId = `amount-${capture.id}`;

  return (
    <li
      className={cn(
        'dimension-row flex-wrap gap-x-4 gap-y-2 py-3',
        isPending && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{capture.description}</span>
          {capture.amount && (
            <span className="dimension-figure text-destructive shrink-0 whitespace-nowrap">
              − {capture.amount}
            </span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          {capture.cardName}, {capture.when}.{' '}
          {capture.status === 'needs_account'
            ? `Espera a conta do cartão ${capture.cardName}, em Cartões da Wallet.`
            : 'Chegou sem valor.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {capture.status === 'needs_amount' && (
          <form onSubmit={record} className="flex items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              Valor de {capture.description}
            </label>
            <input
              id={inputId}
              inputMode="decimal"
              placeholder="23,90"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              className={cn(FIELD_BASE_CLASSES, 'dimension-figure w-28')}
            />
            <Button type="submit" size="sm" disabled={isPending}>
              Registrar
            </Button>
          </form>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={discard}
        >
          Descartar
        </Button>
      </div>
    </li>
  );
}
