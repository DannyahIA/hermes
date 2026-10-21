import type { AvailableToSpend } from '@/modules/dashboard/application/metrics/calculate-available-to-spend';
import type { BudgetPace } from '@/modules/dashboard/application/metrics/calculate-budget-pace';
import { formatCurrency } from '@/shared/lib/format-currency';

const wholeReais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

/**
 * The Início's headline in one line (spec 2026-10-17-telegram-apple-pay-
 * design.md §1): what is still free until the next income, or how much is
 * missing to cover the cards and bills.
 */
export function freeLine(
  available: AvailableToSpend | null,
): string | undefined {
  if (!available) return undefined;
  const until =
    available.horizonKind === 'income'
      ? `até ${dayMonth.format(available.horizon)}`
      : 'até o fim do mês';
  if (available.free < 0) {
    return `Faltam ${formatCurrency(-available.free)} para cobrir cartões e contas ${until}.`;
  }
  const perDay =
    available.perDay === null
      ? ''
      : ` (${wholeReais.format(available.perDay)} por dia)`;
  return `Livre ${until}: ${formatCurrency(available.free)}${perDay}`;
}

/** Warns when the payment's category has spent 80% or more of a running budget. */
export function budgetAlert(
  paces: BudgetPace[],
  categoryId: string | undefined,
  categoryName: string | undefined,
): string | undefined {
  const pace = categoryId
    ? paces.find((candidate) => candidate.categoryId === categoryId)
    : undefined;
  if (!pace || !categoryName || pace.spentShare < 0.8) return undefined;
  const share = `${Math.round(pace.spentShare * 100)}% do orçamento`;
  const note =
    pace.status === 'over'
      ? ', estourado'
      : pace.status === 'ahead'
        ? ', acima do ritmo'
        : '';
  return `${categoryName}: ${share}${note}`;
}
