import type { AvailableToSpend } from '@/modules/dashboard/application/metrics/calculate-available-to-spend';
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
