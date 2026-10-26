'use client';

import { ChevronDown, Ellipsis } from 'lucide-react';
import { useState } from 'react';

import { deleteLoanAction } from '@/app/loans/actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu, MenuItem } from '@/components/ui/menu';
import {
  calculatePriceInstallments,
  summarizeLoan,
} from '@/core/value-objects/loan-amortization';
import { toast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatPercent } from '@/shared/lib/format-percent';

interface LoanRowProps {
  id: string;
  description: string;
  principal: number;
  monthlyInterestRate: number;
  installmentCount: number;
  paidCount: number;
  currency: string;
}

/** "2% ao mês", "1,99% ao mês": the rate with only the decimals it needs. */
function rateLabel(monthlyInterestRate: number): string {
  const hundredths = Math.round(monthlyInterestRate * 10000);
  const digits = hundredths % 100 === 0 ? 0 : hundredths % 10 === 0 ? 1 : 2;
  return `${formatPercent(hundredths / 100, digits)} ao mês`;
}

function remainingLabel(remainingCount: number): string {
  if (remainingCount === 0) return 'Quitado';
  if (remainingCount === 1) return '1 parcela restante';
  return `${remainingCount} parcelas restantes`;
}

/**
 * One loan as a thin row: its name and rate, the installment, how far along
 * it is and what it costs in all. The amortization breakdown is never
 * stored — it's recomputed from the plan's own principal/rate/count every
 * time it's displayed, so it can never drift out of sync (see
 * `core/value-objects/loan-amortization.ts`).
 */
export function LoanRow({
  id,
  description,
  principal,
  monthlyInterestRate,
  installmentCount,
  paidCount,
  currency,
}: LoanRowProps) {
  const [showSchedule, setShowSchedule] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const schedule = calculatePriceInstallments({
    principal,
    monthlyInterestRate,
    installmentCount,
  });
  const summary = summarizeLoan({
    principal,
    monthlyInterestRate,
    installmentCount,
    paidCount,
  });
  const progress = Math.min(paidCount / installmentCount, 1) * 100;

  async function handleDelete() {
    const result = await deleteLoanAction(id);
    toast(
      result.success
        ? { title: 'Empréstimo excluído.', variant: 'success' }
        : {
            title: result.error ?? 'Não foi possível excluir.',
            variant: 'error',
          },
    );
  }

  return (
    <li className="border-border border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="order-1 min-w-0 flex-1 truncate font-medium"
          title={description}
        >
          {description}
        </span>
        <span className="order-3 flex w-full items-baseline justify-between gap-3 sm:order-2 sm:w-auto sm:justify-end">
          <span className="text-muted-foreground shrink-0 text-xs">
            {rateLabel(monthlyInterestRate)}
          </span>
          <span className="dimension-figure text-sm">
            {`${formatCurrency(summary.installment, currency)} por mês`}
          </span>
        </span>
        <span className="order-2 sm:order-3">
          <Menu
            label={`Ações de ${description}`}
            trigger={<Ellipsis aria-hidden className="size-4" />}
            triggerClassName="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring aria-expanded:bg-accent inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-2"
          >
            <MenuItem destructive onSelect={() => setDeleting(true)}>
              Excluir
            </MenuItem>
          </Menu>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`Quanto de ${description} já foi pago`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
        >
          <div
            className="bg-primary h-full rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="dimension-figure text-muted-foreground w-10 text-right text-xs">
          {formatPercent(progress)}
        </span>
      </div>

      <p className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 text-xs">
        <span>{`${paidCount} de ${installmentCount} parcelas`}</span>
        <span>{remainingLabel(summary.remainingCount)}</span>
        <span className="dimension-figure">{`Emprestado ${formatCurrency(principal, currency)}`}</span>
        <span className="dimension-figure">{`Pago ${formatCurrency(summary.paid, currency)}`}</span>
        <span className="dimension-figure">{`Falta ${formatCurrency(summary.remaining, currency)}`}</span>
      </p>
      <p className="text-muted-foreground dimension-figure mt-1 text-xs">
        {`Custo total ${formatCurrency(summary.totalCost, currency)} (${formatCurrency(summary.totalInterest, currency)} de juros)`}
      </p>

      <button
        type="button"
        onClick={() => setShowSchedule((v) => !v)}
        className="text-muted-foreground hover:text-foreground focus-visible:outline-ring mt-2 flex items-center gap-1 rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-expanded={showSchedule}
      >
        {showSchedule ? 'Ocultar parcelas' : 'Ver parcelas detalhadas'}
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-[var(--duration-base)]',
            showSchedule && 'rotate-180',
          )}
        />
      </button>

      {showSchedule && (
        <div className="border-border mt-3 overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="border-border bg-subtle border-b">
              <tr className="text-muted-foreground text-xs [&>th]:px-3">
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
                  className="border-border border-b last:border-none [&>td]:px-3"
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

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir empréstimo"
        description="Isso reverte o saldo das contas envolvidas e remove todas as parcelas restantes. Essa ação não pode ser desfeita."
        onConfirm={handleDelete}
      />
    </li>
  );
}
