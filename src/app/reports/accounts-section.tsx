import { AccountBalanceChart } from '@/components/reports/account-balance-chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { AccountSeries } from '@/modules/reports/application/metrics/calculate-account-series';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatMonthLabel } from '@/shared/lib/format-date';

interface AccountsSectionProps {
  accountSeries: AccountSeries[];
}

/**
 * The "Por conta" tab. The table below the chart is not decoration: it is
 * the non-visual route to the same numbers, so the values stay reachable
 * without hovering a line (and past the palette's slot count, where the
 * chart folds accounts into "Outros", the table still lists each one).
 */
export function AccountsSection({ accountSeries }: AccountsSectionProps) {
  if (accountSeries.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Nenhuma conta visível."
          description="Crie uma conta para acompanhar sua evolução ao longo do tempo."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Saldo por conta</CardTitle>
          <CardDescription>
            Evolução mensal do saldo de cada conta visível.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-6 p-0">
          <AccountBalanceChart accountSeries={accountSeries} />
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle className="text-xl">Tabela de saldos</CardTitle>
          <CardDescription>
            Mesmos dados do gráfico acima, em formato de tabela.
          </CardDescription>
        </CardHeader>
        <CardContent className="mt-4 overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left">
                <th scope="col" className="py-2 pr-4">
                  Conta
                </th>
                {accountSeries[0]?.balanceByMonth.map((point) => (
                  <th
                    scope="col"
                    key={point.month.toISOString()}
                    className="py-2 pr-4 text-right capitalize"
                  >
                    {formatMonthLabel(point.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountSeries.map((series) => (
                <tr
                  key={series.accountId}
                  className="border-border border-b last:border-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-4 text-left font-medium"
                  >
                    {series.accountName}
                  </th>
                  {series.balanceByMonth.map((point) => (
                    <td
                      key={point.month.toISOString()}
                      className="dimension-figure py-2 pr-4 text-right"
                    >
                      {formatCurrency(point.netWorth)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
