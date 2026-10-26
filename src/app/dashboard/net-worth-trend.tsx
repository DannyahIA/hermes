import { Section, SectionHeader, SectionLink } from '@/components/ui/section';
import { ROUTES } from '@/config/routes';
import type { NetWorthPoint } from '@/modules/reports/application/metrics/calculate-net-worth-by-month';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatMonthLabel } from '@/shared/lib/format-date';

import { NetWorthLine } from './net-worth-line';

const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' });

/**
 * Where net worth stands and how it moved since the end of last month,
 * with six months of history (spec 2026-10-17-inicio-hub-design.md §4.7).
 * Replaces the cash-flow chart, which lives on in Relatórios (D4).
 */
export function NetWorthTrend({ points }: { points: NetWorthPoint[] }) {
  const current = points.at(-1);
  const previous = points.at(-2);
  if (!current) return null;

  const change = previous ? current.netWorth - previous.netWorth : null;
  const labeled = points.map((point) => ({
    label: formatMonthLabel(point.month).replace('.', ''),
    month: point.month,
    netWorth: point.netWorth,
  }));

  return (
    <Section>
      <SectionHeader
        title="Patrimônio"
        description="O que você tem menos o que deve nos cartões, mês a mês."
        action={<SectionLink href={ROUTES.reports}>Relatórios</SectionLink>}
      />
      <div>
        <div>
          <p className="dimension-figure text-figure font-semibold whitespace-nowrap">
            {formatCurrency(current.netWorth)}
          </p>
          {change !== null && previous && (
            <p className="text-muted-foreground mt-1 text-sm">
              <span
                className={cn(
                  'dimension-figure whitespace-nowrap',
                  change >= 0.005 && 'text-success',
                  change <= -0.005 && 'text-destructive',
                )}
              >
                {change >= 0.005 ? '↑ + ' : change <= -0.005 ? '↓ − ' : ''}
                {formatCurrency(Math.abs(change))}
              </span>{' '}
              desde o fim de {monthName.format(previous.month)}
            </p>
          )}
        </div>
        {points.length > 1 && (
          <div>
            <NetWorthLine points={labeled} />
            <details className="group mt-2">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
                Ver mês a mês
              </summary>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {labeled.map((point, index) => (
                    <tr
                      key={point.month.toISOString()}
                      className="border-border border-b last:border-0"
                    >
                      <th
                        scope="row"
                        className="text-muted-foreground py-1.5 text-left font-normal capitalize"
                      >
                        {index === labeled.length - 1
                          ? `${monthName.format(point.month)} (até hoje)`
                          : monthName.format(point.month)}
                      </th>
                      <td className="dimension-figure py-1.5 text-right whitespace-nowrap">
                        {formatCurrency(point.netWorth)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        )}
      </div>
    </Section>
  );
}
