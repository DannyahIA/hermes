import { StyleSheet, Text, View } from '@react-pdf/renderer';

import type { AccountSeries } from '@/modules/reports/application/metrics/calculate-account-series';
import { formatCurrency } from '@/shared/lib/format-currency';

import { MonthlyBars } from './monthly-bars';
import { formatMonthYear, monthKey } from './pdf-format';
import { type PdfColumn, PdfTable } from './pdf-table';
import { CONTENT_WIDTH, FONT, INK, textStyles, TYPE } from './pdf-theme';
import { SheetSection } from './sheet-section';

export const ACCOUNTS_NOTES = [
  'Valores em reais. Contas ocultas não aparecem nesta folha.',
  'O saldo de cada mês é reconstruído a partir do saldo atual da conta; meses depois da data de emissão ficam de fora.',
];

const SUMMARY_WIDTH = 150;
const PANEL_GAP = 16;
/** Accounts per balance table, so each column keeps room for a full amount. */
const ACCOUNTS_PER_TABLE = 4;

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: INK.construction,
    borderBottomStyle: 'dashed',
  },
  name: {
    fontSize: TYPE.body + 0.5,
    fontWeight: 600,
    marginBottom: 6,
  },
  balance: {
    fontFamily: FONT.figure,
    fontWeight: 500,
    fontSize: TYPE.figure,
    marginTop: 1,
  },
  flow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  flowFigure: {
    fontFamily: FONT.figure,
    fontSize: TYPE.caption,
    marginTop: 1,
  },
});

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Small multiples: one panel per account, each on its own scale, so a small account's shape isn't flattened by a large one. */
export function AccountsSheet({ accounts }: { accounts: AccountSeries[] }) {
  if (accounts.length === 0) {
    return (
      <SheetSection title="Saldo por conta">
        <Text style={textStyles.empty}>
          Nenhuma conta visível. Crie uma conta para acompanhar a evolução do
          saldo aqui.
        </Text>
      </SheetSection>
    );
  }

  const months = accounts[0]?.balanceByMonth.map((p) => p.month) ?? [];

  return (
    <View>
      <SheetSection
        title="Saldo por conta"
        caption="Saldo de cada conta visível no fim de cada mês, com as entradas e saídas do período (nota 2)."
      >
        {accounts.map((account, index) => (
          <AccountPanel
            key={account.accountId}
            account={account}
            last={index === accounts.length - 1}
          />
        ))}
      </SheetSection>

      {months.length > 0 &&
        chunk(accounts, ACCOUNTS_PER_TABLE).map((group, index) => (
          <SheetSection
            key={group.map((a) => a.accountId).join()}
            title={
              index === 0 ? 'Tabela de saldos' : 'Tabela de saldos, continuação'
            }
            caption={index === 0 ? 'Os valores dos gráficos acima.' : undefined}
          >
            <PdfTable
              rows={months}
              rowKey={monthKey}
              columns={[
                { header: 'Mês', width: 84, render: formatMonthYear },
                ...group.map((account): PdfColumn<Date> => ({
                  header: account.accountName,
                  figure: true,
                  render: (month) => {
                    const point = account.balanceByMonth.find(
                      (p) => monthKey(p.month) === monthKey(month),
                    );
                    return point ? formatCurrency(point.netWorth) : '';
                  },
                })),
              ]}
            />
          </SheetSection>
        ))}
    </View>
  );
}

function AccountPanel({
  account,
  last,
}: {
  account: AccountSeries;
  last: boolean;
}) {
  const latest = account.balanceByMonth.at(-1);
  const income = account.cashFlowByMonth.reduce((sum, m) => sum + m.income, 0);
  const expense = account.cashFlowByMonth.reduce(
    (sum, m) => sum + m.expense,
    0,
  );

  return (
    <View
      wrap={false}
      style={last ? [styles.panel, { borderBottomWidth: 0 }] : styles.panel}
    >
      <View style={{ width: SUMMARY_WIDTH }}>
        <Text style={styles.name}>{account.accountName}</Text>
        {latest && (
          <>
            <Text style={textStyles.label}>
              Saldo em {formatMonthYear(latest.month)}
            </Text>
            <Text
              style={[
                styles.balance,
                { color: latest.netWorth < 0 ? INK.redline : INK.text },
              ]}
            >
              {formatCurrency(latest.netWorth)}
            </Text>
          </>
        )}
        <View style={styles.flow}>
          <View style={{ width: SUMMARY_WIDTH / 2 }}>
            <Text style={textStyles.label}>Entradas</Text>
            <Text style={styles.flowFigure}>{formatCurrency(income)}</Text>
          </View>
          <View>
            <Text style={textStyles.label}>Saídas</Text>
            <Text style={styles.flowFigure}>{formatCurrency(expense)}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginLeft: PANEL_GAP }}>
        {account.balanceByMonth.length > 0 ? (
          <MonthlyBars
            months={account.balanceByMonth.map((p) => p.month)}
            series={[
              {
                values: account.balanceByMonth.map((p) => p.netWorth),
                fill: (v) => (v >= 0 ? INK.blueline : INK.redline),
              },
            ]}
            width={CONTENT_WIDTH - SUMMARY_WIDTH - PANEL_GAP}
            height={54}
          />
        ) : (
          <Text style={textStyles.empty}>
            Sem dados suficientes para este período.
          </Text>
        )}
      </View>
    </View>
  );
}
