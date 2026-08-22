'use client';

import { ChevronDown } from 'lucide-react';
import { useState, useTransition } from 'react';

import { deleteLoanAction } from '@/app/loans/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { calculatePriceInstallments } from '@/core/value-objects/loan-amortization';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

interface LoanCardProps {
  id: string;
  description: string;
  principal: number;
  monthlyInterestRate: number;
  installmentCount: number;
  paidCount: number;
  currency: string;
}

/**
 * The amortization breakdown is never stored — it's recomputed from the
 * plan's own principal/rate/count every time it's displayed, so it can
 * never drift out of sync (see `core/value-objects/loan-amortization.ts`).
 */
export function LoanCard({
  id,
  description,
  principal,
  monthlyInterestRate,
  installmentCount,
  paidCount,
  currency,
}: LoanCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showSchedule, setShowSchedule] = useState(false);
  const schedule = calculatePriceInstallments({
    principal,
    monthlyInterestRate,
    installmentCount,
  });
  const progress = Math.min(paidCount / installmentCount, 1) * 100;

  return (
    <Card className="p-6">
      <CardHeader className="mb-4 flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{description}</CardTitle>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <span className="dimension-figure">
              {formatCurrency(principal, currency)}
            </span>
            <Badge variant="secondary">
              {(monthlyInterestRate * 100).toLocaleString('pt-BR', {
                maximumFractionDigits: 2,
              })}
              % a.m.
            </Badge>
          </div>
        </div>

        <ConfirmDialog
          trigger={
            <Button variant="destructive" size="sm" disabled={isPending}>
              {isPending ? 'Excluindo…' : 'Excluir'}
            </Button>
          }
          title="Excluir empréstimo"
          description="Isso reverte o saldo das contas envolvidas e remove todas as parcelas restantes. Essa ação não pode ser desfeita."
          onConfirm={() =>
            startTransition(async () => {
              const result = await deleteLoanAction(id);
              toast(
                result.success
                  ? { title: 'Empréstimo excluído.', variant: 'success' }
                  : {
                      title: result.error ?? 'Não foi possível excluir.',
                      variant: 'error',
                    },
              );
            })
          }
        />
      </CardHeader>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {paidCount} de {installmentCount} parcelas
          </span>
          <span className="text-muted-foreground dimension-figure">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="bg-muted h-1.5">
          <div className="bg-primary h-1.5" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowSchedule((v) => !v)}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 text-xs font-semibold tracking-wide uppercase transition-colors"
        aria-expanded={showSchedule}
      >
        {showSchedule ? 'Ocultar parcelas' : 'Ver parcelas detalhadas'}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            showSchedule && 'rotate-180',
          )}
        />
      </button>

      {showSchedule && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-border/70 border-b">
              <tr className="text-muted-foreground text-xs uppercase">
                <th className="py-2 pr-4 font-medium">Parcela</th>
                <th className="py-2 pr-4 text-right font-medium">Valor</th>
                <th className="py-2 pr-4 text-right font-medium">Juros</th>
                <th className="py-2 pr-4 text-right font-medium">
                  Amortização
                </th>
                <th className="py-2 text-right font-medium">Saldo devedor</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((installment) => (
                <tr
                  key={installment.number}
                  className="border-border/70 border-b last:border-none"
                >
                  <td className="py-2 pr-4">{installment.number}</td>
                  <td className="dimension-figure py-2 pr-4 text-right">
                    {formatCurrency(installment.amount, currency)}
                  </td>
                  <td className="dimension-figure py-2 pr-4 text-right">
                    {formatCurrency(installment.interestPortion, currency)}
                  </td>
                  <td className="dimension-figure py-2 pr-4 text-right">
                    {formatCurrency(installment.principalPortion, currency)}
                  </td>
                  <td className="dimension-figure py-2 text-right">
                    {formatCurrency(installment.remainingBalance, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
