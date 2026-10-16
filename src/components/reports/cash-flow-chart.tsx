'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';
import {
  CHART_EXPENSE_COLOR,
  CHART_GRID_COLOR,
  CHART_INCOME_COLOR,
} from '@/shared/constants/chart-colors';
import type { MonthlyCashFlow } from '@/shared/lib/build-monthly-cash-flow';
import { formatMonthLabel } from '@/shared/lib/format-date';

interface CashFlowChartProps {
  months: MonthlyCashFlow[];
}

/**
 * Money in versus money out, month by month. The two series are a good/bad
 * pair rather than two arbitrary categories, so they keep the project's
 * status colors (the drafting "redline" convention for expense) instead of
 * drawing from the categorical palette.
 */
export function CashFlowChart({ months }: CashFlowChartProps) {
  const data = months.map((month) => ({
    month: formatMonthLabel(month.month),
    Receitas: month.income,
    Despesas: month.expense,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="Receitas"
            fill={CHART_INCOME_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
          <Bar
            dataKey="Despesas"
            fill={CHART_EXPENSE_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
