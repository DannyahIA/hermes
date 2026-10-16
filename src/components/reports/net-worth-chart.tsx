'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';
import type { NetWorthPoint } from '@/modules/reports/application/metrics/calculate-net-worth-by-month';
import {
  CHART_EXPENSE_COLOR,
  CHART_GRID_COLOR,
  CHART_PRIMARY_COLOR,
} from '@/shared/constants/chart-colors';
import { formatMonthLabel } from '@/shared/lib/format-date';

interface NetWorthChartProps {
  points: NetWorthPoint[];
}

/**
 * Net worth is a single series that can cross zero, so this is a diverging
 * bar (above/below a baseline), not a line — and the sign, not the category,
 * picks the color: primary ink above zero, red ink below. Same convention the
 * hand-rolled bars used before Recharts.
 */
export function NetWorthChart({ points }: NetWorthChartProps) {
  const data = points.map((point) => ({
    month: formatMonthLabel(point.month),
    netWorth: point.netWorth,
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
          <ReferenceLine y={0} stroke={CHART_GRID_COLOR} />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          />
          <Bar
            dataKey="netWorth"
            name="Patrimônio"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          >
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={
                  entry.netWorth >= 0
                    ? CHART_PRIMARY_COLOR
                    : CHART_EXPENSE_COLOR
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
