import { Text, View } from '@react-pdf/renderer';

import type { PeriodComparison } from '@/modules/reports/application/metrics/calculate-period-comparison';
import type { PeriodDelta } from '@/modules/reports/application/metrics/calculate-period-delta';
import type { CategoryTrendStats } from '@/modules/reports/application/metrics/calculate-trend-stats';
import { formatCurrency } from '@/shared/lib/format-currency';

import { formatDelta, formatShortDate } from './pdf-format';
import { PdfTable } from './pdf-table';
import { INK, textStyles } from './pdf-theme';
import { SheetSection } from './sheet-section';

export const COMPARISONS_NOTES = [
  'Ano a ano e mesmo mês são ancorados na data de emissão, não no período deste relatório. O mês atual ainda está em andamento, então é comparado ao mês inteiro do ano anterior.',
  'A tendência precisa de pelo menos dois meses com despesa na categoria; com menos, aparece "Dado insuficiente".',
];

const TREND_LABELS: Record<CategoryTrendStats['trend'], string> = {
  subindo: '↑ Subindo',
  caindo: '↓ Caindo',
  estável: 'Estável',
  insuficiente: 'Dado insuficiente',
};

interface DeltaRow {
  label: string;
  delta: PeriodDelta;
  /** More income is good news; more expense is not. */
  upIsGood: boolean;
}

function DeltaTable({
  comparison,
  currentHeader,
  previousHeader,
}: {
  comparison: PeriodComparison;
  currentHeader: string;
  previousHeader: string;
}) {
  const rows: DeltaRow[] = [
    { label: 'Receitas', delta: comparison.income, upIsGood: true },
    { label: 'Despesas', delta: comparison.expense, upIsGood: false },
  ];

  return (
    <PdfTable
      rows={rows}
      rowKey={(r) => r.label}
      columns={[
        { header: '', width: 84, render: (r) => r.label },
        {
          header: currentHeader,
          figure: true,
          render: (r) => formatCurrency(r.delta.currentTotal),
        },
        {
          header: previousHeader,
          figure: true,
          render: (r) => formatCurrency(r.delta.previousTotal),
        },
        {
          header: 'Variação',
          width: 96,
          figure: true,
          // Direction × whether up is good, like the app's StatTile; the
          // arrow and sign repeat it so it never rests on color alone.
          color: ({ delta, upIsGood }) => {
            if (delta.deltaPercent === null || delta.deltaPercent === 0) {
              return INK.graphite;
            }
            return delta.deltaPercent > 0 === upIsGood
              ? INK.blueline
              : INK.redline;
          },
          render: ({ delta }) =>
            delta.deltaPercent === null
              ? 'Sem dado anterior'
              : formatDelta(delta.deltaPercent),
        },
      ]}
    />
  );
}

const monthName = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);

export function ComparisonsSheet({
  yearOverYear,
  sameMonthLastYear,
  trendStats,
  issuedAt,
}: {
  yearOverYear: PeriodComparison;
  sameMonthLastYear: PeriodComparison;
  trendStats: CategoryTrendStats[];
  issuedAt: Date;
}) {
  const year = issuedAt.getFullYear();
  const month = monthName(issuedAt);
  const shortMonth = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
  }).format(issuedAt);

  return (
    <View>
      <SheetSection
        title="Ano a ano"
        caption={`De 1º de janeiro até ${formatShortDate(issuedAt)}, comparado ao mesmo intervalo de ${year - 1} (nota 1).`}
        keepTogether
      >
        <DeltaTable
          comparison={yearOverYear}
          currentHeader={String(year)}
          previousHeader={String(year - 1)}
        />
      </SheetSection>

      <SheetSection
        title="Mesmo mês, ano passado"
        caption={`${month[0]?.toUpperCase()}${month.slice(1)} de ${year} até a data de emissão, comparado a ${month} de ${year - 1} (nota 1).`}
        keepTogether
      >
        <DeltaTable
          comparison={sameMonthLastYear}
          currentHeader={`${shortMonth} ${year}`}
          previousHeader={`${shortMonth} ${year - 1}`}
        />
      </SheetSection>

      <SheetSection
        title="Tendência por categoria"
        caption="Média, mediana e direção da despesa mensal no período do relatório (nota 2)."
      >
        {trendStats.length === 0 ? (
          <Text style={textStyles.empty}>
            Sem dados suficientes no período selecionado.
          </Text>
        ) : (
          <PdfTable
            rows={trendStats}
            rowKey={(s) => s.categoryId}
            columns={[
              { header: 'Categoria', render: (s) => s.categoryName },
              {
                header: 'Média mensal',
                width: 96,
                figure: true,
                render: (s) => formatCurrency(s.average),
              },
              {
                header: 'Mediana mensal',
                width: 96,
                figure: true,
                render: (s) => formatCurrency(s.median),
              },
              {
                header: 'Tendência',
                width: 92,
                render: (s) => TREND_LABELS[s.trend],
              },
            ]}
          />
        )}
      </SheetSection>
    </View>
  );
}
