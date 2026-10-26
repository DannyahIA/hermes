import Link from 'next/link';

import { ROUTES } from '@/config/routes';
import type { AvailableToSpend } from '@/modules/dashboard/application/metrics/calculate-available-to-spend';
import type { MonthToDate } from '@/modules/dashboard/application/metrics/calculate-month-to-date';
import { cn } from '@/shared/lib/cn';
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

/** "Agendado" — committed but not paid yet — reads as hatched redline. */
const HATCH =
  'border border-destructive bg-[repeating-linear-gradient(135deg,var(--destructive)_0_1.5px,transparent_1.5px_6px)]';

interface AvailableHeroProps {
  available: AvailableToSpend | null;
  /** What's owed on cards today — shown instead when there's no checking account. */
  owedOnCards: number;
  monthToDate: MonthToDate;
  netWorth: number;
  projectedNetWorth: number;
}

/**
 * The Início header (spec 2026-10-17-inicio-hub-design.md §4.1): how much
 * of the checking balance is still free until the next income, drawn as a
 * chain dimension — the balance split into what's owed on cards, what's
 * scheduled and what's left, segments that add up to the whole, like a
 * drawing's consecutive dimensions. The month so far and net worth sit
 * beside it.
 */
export function AvailableHero({
  available,
  owedOnCards,
  monthToDate,
  netWorth,
  projectedNetWorth,
}: AvailableHeroProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
      <div className="min-w-0">
        {available ? (
          <FreeToSpend available={available} />
        ) : (
          <NoChecking owedOnCards={owedOnCards} />
        )}
      </div>

      <dl className="border-border lg:divide-border grid grid-cols-2 content-start gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-3 lg:grid-cols-1 lg:gap-y-0 lg:divide-y lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 lg:[&>div]:py-3.5 lg:[&>div:first-child]:pt-0 lg:[&>div:last-child]:pb-0">
        <Figure label="Recebido no mês" value={monthToDate.received} />
        <Figure label="Gasto no mês" value={monthToDate.spent}>
          <SpendingComparison monthToDate={monthToDate} />
        </Figure>
        <Figure
          label="Patrimônio"
          value={netWorth}
          className="col-span-2 sm:col-span-1"
        >
          {Math.abs(projectedNetWorth - netWorth) >= 0.005 && (
            <>
              Com as parcelas futuras,{' '}
              <span className="dimension-figure whitespace-nowrap">
                {formatCurrency(projectedNetWorth)}
              </span>
            </>
          )}
        </Figure>
      </dl>
    </div>
  );
}

function FreeToSpend({ available }: { available: AvailableToSpend }) {
  const { inChecking, owedOnCards, scheduled, free, horizon } = available;
  const until = dayMonth.format(horizon);
  const scheduledLabel = `A pagar até ${until}`;

  if (inChecking <= 0) {
    return (
      <>
        <p className="text-muted-foreground text-sm font-medium">
          Conta corrente no negativo
        </p>
        <p className="dimension-figure text-destructive md:text-display mt-2 text-4xl font-semibold whitespace-nowrap">
          {formatCurrency(inChecking)}
        </p>
        <p className="text-muted-foreground mt-2 max-w-prose text-sm">
          Além disso, há{' '}
          <span className="dimension-figure whitespace-nowrap">
            {formatCurrency(owedOnCards)}
          </span>{' '}
          em cartões e{' '}
          <span className="dimension-figure whitespace-nowrap">
            {formatCurrency(scheduled)}
          </span>{' '}
          agendados até {until}.
        </p>
      </>
    );
  }

  const committed = owedOnCards + scheduled;
  const short = free < 0;
  // The bar measures the larger of the two: the balance, or what it has to
  // cover when that's more.
  const scale = Math.max(inChecking, committed);
  const width = (value: number) => `${(value / scale) * 100}%`;

  const segments = [
    {
      key: 'cards',
      label: 'Cartões',
      value: owedOnCards,
      fill: 'bg-destructive',
    },
    {
      key: 'scheduled',
      label: scheduledLabel,
      value: scheduled,
      fill: HATCH,
    },
    ...(short
      ? []
      : [
          {
            key: 'free',
            label: 'Livre',
            value: free,
            fill: 'bg-primary',
          },
        ]),
  ].filter((segment) => segment.value > 0);

  return (
    <>
      <p className="text-muted-foreground text-sm font-medium">
        {short
          ? `Comprometido além do saldo até ${until}`
          : available.horizonKind === 'income'
            ? `Livre até ${until}`
            : 'Livre até o fim do mês'}
      </p>
      <p
        className={cn(
          'dimension-figure md:text-display mt-2 text-4xl font-semibold whitespace-nowrap',
          short && 'text-destructive',
        )}
      >
        {formatCurrency(free)}
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        {short ? (
          <>
            Faltam{' '}
            <span className="dimension-figure">{formatCurrency(-free)}</span>{' '}
            para cobrir cartões e contas até {until}
            {available.horizonKind === 'income' &&
              ', quando entra ' + available.incomeDescription}
            .
          </>
        ) : available.perDay !== null ? (
          <>
            <span className="dimension-figure">
              {wholeReais.format(available.perDay)}
            </span>{' '}
            por dia{' '}
            {available.horizonKind === 'income'
              ? `até ${until}, quando entra ${available.incomeDescription}`
              : `nos ${available.daysLeft} dias que faltam`}
            .
          </>
        ) : (
          'Nada livre até a próxima entrada.'
        )}
      </p>

      <div className="mt-7" aria-hidden>
        {/* Overall dimension: the checking balance the chain adds up to. */}
        <div
          className="flex items-center gap-2"
          style={{ width: width(inChecking) }}
        >
          <span className="dimension-line min-w-4 flex-1" />
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            Em conta corrente{' '}
            <span className="dimension-figure text-foreground">
              {formatCurrency(inChecking)}
            </span>
          </span>
          <span className="dimension-line min-w-4 flex-1" />
        </div>

        <div className="mt-2 flex h-3 gap-0.5">
          {segments.map((segment) => (
            <span
              key={segment.key}
              className={cn('h-full shrink-0 rounded-[3px]', segment.fill)}
              style={{ width: width(segment.value) }}
            />
          ))}
        </div>
        {short && (
          <div
            className="border-destructive -mt-3 h-3 border-r-2 border-dashed"
            style={{ width: width(inChecking) }}
          />
        )}

        {/* Chain dimensions under each segment. */}
        <div className="mt-2 flex gap-0.5">
          {segments.map((segment) => (
            <span
              key={segment.key}
              className="dimension-line shrink-0"
              style={{ width: width(segment.value) }}
            />
          ))}
        </div>
      </div>

      <dl className="mt-4 grid gap-y-2 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className="flex items-baseline gap-2 sm:whitespace-nowrap"
          >
            <span
              aria-hidden
              className={cn(
                'inline-block size-2.5 shrink-0 rounded-[3px]',
                segment.fill,
              )}
            />
            <dt className="text-muted-foreground">{segment.label}</dt>
            <dd className="dimension-figure ml-auto whitespace-nowrap sm:ml-0">
              {formatCurrency(segment.value)}
            </dd>
          </div>
        ))}
        {short && (
          <div className="flex items-baseline gap-2 sm:whitespace-nowrap">
            <span
              aria-hidden
              className="border-destructive inline-block size-2.5 shrink-0 rounded-[3px] border-2 border-dashed"
            />
            <dt className="text-muted-foreground">Falta</dt>
            <dd className="dimension-figure text-destructive ml-auto whitespace-nowrap sm:ml-0">
              {formatCurrency(-free)}
            </dd>
          </div>
        )}
      </dl>
    </>
  );
}

function NoChecking({ owedOnCards }: { owedOnCards: number }) {
  return (
    <>
      <p className="text-muted-foreground text-sm font-medium">
        Devido nos cartões
      </p>
      <p className="dimension-figure md:text-display mt-2 text-4xl font-semibold whitespace-nowrap">
        {formatCurrency(owedOnCards)}
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        <Link href={ROUTES.accounts} className="text-foreground underline">
          Cadastre sua conta corrente
        </Link>{' '}
        para ver quanto ainda pode gastar até a próxima entrada.
      </p>
    </>
  );
}

function Figure({
  label,
  value,
  className,
  children,
}: {
  label: string;
  value: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="dimension-figure text-figure mt-0.5 font-semibold whitespace-nowrap">
        {formatCurrency(value)}
      </dd>
      {children && (
        <dd className="text-muted-foreground mt-1 text-xs">{children}</dd>
      )}
    </div>
  );
}

function SpendingComparison({ monthToDate }: { monthToDate: MonthToDate }) {
  const { spent, spentLastMonthSameDay, lastMonthSameDay } = monthToDate;
  if (spentLastMonthSameDay === null) return null;

  const difference = spent - spentLastMonthSameDay;
  const when = dayMonth.format(lastMonthSameDay);
  if (Math.abs(difference) < 0.005) return <>Igual a {when}</>;

  return (
    <>
      {difference > 0 ? '↑ ' : '↓ '}
      <span className="dimension-figure whitespace-nowrap">
        {formatCurrency(Math.abs(difference))}
      </span>{' '}
      {difference > 0 ? 'a mais' : 'a menos'} que até {when}
    </>
  );
}
