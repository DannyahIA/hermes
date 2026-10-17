import Link from 'next/link';

import { PayBillDialog } from '@/app/accounts/pay-bill-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/config/routes';
import type {
  CardCycle,
  CardStatement,
} from '@/modules/dashboard/application/metrics/calculate-card-statements';
import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

const dayMonth = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

interface CardStatementsProps {
  statements: CardStatement[];
  /** Cash accounts a bill can be paid from. */
  payingAccounts: Array<{ id: string; name: string }>;
  today: Date;
}

/**
 * One block per credit card (spec 2026-10-17-inicio-hub-design.md §4.3):
 * what's owed, how far into the current statement today is, and the open
 * and closed bills with their due dates.
 */
export function CardStatements({
  statements,
  payingAccounts,
  today,
}: CardStatementsProps) {
  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle className="text-xl">Cartões</CardTitle>
        <CardDescription>
          Quanto você deve em cada cartão e quando vence.
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-2 p-0">
        {statements.map((statement) => (
          <div key={statement.accountId} className="dimension-row block">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate font-medium" title={statement.name}>
                {statement.name}
              </p>
              <p className="dimension-figure text-lg font-semibold whitespace-nowrap">
                {formatCurrency(statement.owed)}
              </p>
            </div>

            {statement.cycle ? (
              <>
                <CycleRuler cycle={statement.cycle} today={today} />
                <dl className="mt-3 space-y-1 text-sm">
                  <BillLine
                    label={`Fatura aberta, vence ${dayMonth.format(statement.cycle.openDueOn)}`}
                    amount={statement.cycle.open}
                  />
                  {statement.cycle.closedUnpaid >= 0.005 && (
                    <BillLine
                      label={`Fatura fechada, ${
                        statement.cycle.overdue ? 'venceu' : 'vence'
                      } ${dayMonth.format(statement.cycle.closedDueOn)}`}
                      amount={statement.cycle.closedUnpaid}
                      overdue={statement.cycle.overdue}
                    />
                  )}
                </dl>
              </>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">
                <Link
                  href={ROUTES.accounts}
                  className="text-foreground underline"
                >
                  Defina o fechamento e o vencimento
                </Link>{' '}
                para ver a fatura.
              </p>
            )}

            {statement.owed >= 0.005 && payingAccounts.length > 0 && (
              <div className="mt-3">
                <PayBillDialog
                  creditAccountId={statement.accountId}
                  balance={
                    statement.cycle && statement.cycle.closedUnpaid >= 0.005
                      ? statement.cycle.closedUnpaid
                      : statement.owed
                  }
                  payingAccounts={payingAccounts}
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * How far into the current statement today is: a ruler from the last
 * closing to the next, with a mark for today.
 */
function CycleRuler({ cycle, today }: { cycle: CardCycle; today: Date }) {
  const span = cycle.nextClosing.getTime() - cycle.lastClosing.getTime();
  const elapsed = Math.min(
    1,
    Math.max(0, (today.getTime() - cycle.lastClosing.getTime()) / span),
  );

  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-2">
        <span className="dimension-line absolute inset-x-0 top-1/2 my-0" />
        <span
          className="bg-foreground absolute top-1/2 h-px"
          style={{ left: 0, width: `${elapsed * 100}%` }}
        />
        <span
          className="border-card bg-foreground absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
          style={{ left: `${elapsed * 100}%` }}
        />
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
        <span>abriu {dayMonth.format(cycle.lastClosing)}</span>
        <span>fecha {dayMonth.format(cycle.nextClosing)}</span>
      </div>
    </div>
  );
}

function BillLine({
  label,
  amount,
  overdue = false,
}: {
  label: string;
  amount: number;
  overdue?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt
        className={cn('text-muted-foreground', overdue && 'text-destructive')}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'dimension-figure whitespace-nowrap',
          overdue && 'text-destructive',
        )}
      >
        {formatCurrency(amount)}
      </dd>
    </div>
  );
}
