'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';
import type { AccountSeries } from '@/modules/reports/application/metrics/calculate-account-series';
import {
  CHART_CATEGORICAL_COLORS,
  CHART_GRID_COLOR,
  CHART_OTHER_COLOR,
  CHART_OTHER_LABEL,
} from '@/shared/constants/chart-colors';
import { formatMonthLabel } from '@/shared/lib/format-date';
import { splitPastLimit } from '@/shared/lib/split-past-limit';

interface AccountBalanceChartProps {
  accountSeries: AccountSeries[];
}

const MAX_LINES = CHART_CATEGORICAL_COLORS.length;

/**
 * Multiple accounts over time: the job is telling distinct series apart, so
 * this is the one time-series chart that draws from the categorical palette.
 * Recharts wants one row per month with a key per account, so the per-account
 * arrays get pivoted into that shape here. Past the palette's slot count the
 * tail accounts are summed into a single "Outros" line rather than inventing
 * a hue the eye can't separate.
 */
export function AccountBalanceChart({
  accountSeries,
}: AccountBalanceChartProps) {
  const { head: shown, tail: folded } = splitPastLimit(
    accountSeries,
    MAX_LINES,
  );

  const months = shown[0]?.balanceByMonth.map((point) => point.month) ?? [];
  const data = months.map((month, index) => {
    const row: Record<string, string | number> = {
      month: formatMonthLabel(month),
    };
    for (const series of shown) {
      row[series.accountName] = series.balanceByMonth[index]?.netWorth ?? 0;
    }
    if (folded.length > 0) {
      row[CHART_OTHER_LABEL] = folded.reduce(
        (sum, series) => sum + (series.balanceByMonth[index]?.netWorth ?? 0),
        0,
      );
    }
    return row;
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {shown.map((series, index) => (
            <Line
              key={series.accountId}
              type="monotone"
              dataKey={series.accountName}
              stroke={CHART_CATEGORICAL_COLORS[index]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
          {folded.length > 0 && (
            <Line
              type="monotone"
              dataKey={CHART_OTHER_LABEL}
              stroke={CHART_OTHER_COLOR}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
