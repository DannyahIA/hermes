import Link from 'next/link';

import { Section, SectionHeader } from '@/components/ui/section';
import { ROUTES } from '@/config/routes';
import type {
  Upcoming,
  UpcomingItem,
} from '@/modules/dashboard/application/metrics/calculate-upcoming';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

const VISIBLE_ITEMS = 8;

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

interface UpcomingListProps {
  upcoming: Upcoming;
  today: Date;
}

/**
 * What comes in and goes out over the next 30 days (spec
 * 2026-10-17-inicio-hub-design.md §4.5): recurring bills and income,
 * installments and card bills, by date.
 */
export function UpcomingList({ upcoming, today }: UpcomingListProps) {
  const through = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 30,
  );
  const first = upcoming.items.slice(0, VISIBLE_ITEMS);
  const rest = upcoming.items.slice(VISIBLE_ITEMS);

  return (
    <Section>
      <SectionHeader
        title="Próximos 30 dias"
        description={`Contas, parcelas, faturas e entradas até ${dayMonth.format(through)}.`}
      />
      <div>
        {upcoming.items.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Nada agendado para os próximos 30 dias.{' '}
            <Link
              href={ROUTES.transactions}
              className="text-foreground underline"
            >
              Criar recorrência
            </Link>
          </p>
        ) : (
          <>
            <ul>
              {first.map((item, index) => (
                <UpcomingRow key={index} item={item} />
              ))}
            </ul>
            {rest.length > 0 && (
              <details className="group">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer py-2 text-sm">
                  <span className="group-open:hidden">
                    Ver os outros {rest.length}
                  </span>
                  <span className="hidden group-open:inline">
                    Mostrar menos
                  </span>
                </summary>
                <ul>
                  {rest.map((item, index) => (
                    <UpcomingRow key={index} item={item} />
                  ))}
                </ul>
              </details>
            )}
            <p className="text-muted-foreground border-border mt-2 border-t pt-3 text-sm">
              Saem{' '}
              <span className="dimension-figure text-foreground whitespace-nowrap">
                {formatCurrency(upcoming.totalOut)}
              </span>
              {upcoming.totalIn > 0 && (
                <>
                  {' '}
                  e entram{' '}
                  <span className="dimension-figure text-foreground whitespace-nowrap">
                    {formatCurrency(upcoming.totalIn)}
                  </span>
                </>
              )}{' '}
              até {dayMonth.format(through)}.
            </p>
          </>
        )}
      </div>
    </Section>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const note = item.overdue ? 'vencida' : item.partial ? 'ainda aberta' : null;

  return (
    <li className="dimension-row gap-3">
      {/* On a phone the date moves under the description, leaving the
          width to the description. */}
      <span
        className={cn(
          'dimension-figure text-muted-foreground hidden w-12 shrink-0 text-sm sm:block',
          item.overdue && 'text-destructive',
        )}
      >
        {dayMonth.format(item.date)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" title={item.description}>
          {item.description}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          <span
            className={cn(
              'dimension-figure sm:hidden',
              item.overdue && 'text-destructive',
            )}
          >
            {dayMonth.format(item.date)},{' '}
          </span>
          {item.accountName}
          {note && (
            <span className={cn(item.overdue && 'text-destructive')}>
              , {note}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          'dimension-figure shrink-0 whitespace-nowrap',
          item.type === 'income' ? 'text-success' : 'text-destructive',
        )}
      >
        {item.type === 'income' ? '+ ' : '− '}
        {formatCurrency(item.amount)}
      </span>
    </li>
  );
}
