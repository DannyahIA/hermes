'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartTooltipContent } from '@/components/ui/chart-tooltip';
import {
  CHART_AXIS_TEXT_COLOR,
  CHART_GRID_COLOR,
  CHART_PRIMARY_COLOR,
} from '@/shared/constants/chart-colors';

interface NetWorthLineProps {
  /** Already labeled on the server, so the axis matches the table below it. */
  points: Array<{ label: string; netWorth: number }>;
}

/**
 * One series over six months — a line, with each month's value on hover
 * and in the table beside it. The zero line shows up only when net worth
 * crosses it.
 */
export function NetWorthLine({ points }: NetWorthLineProps) {
  const values = points.map((point) => point.netWorth);
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={points}
          margin={{ top: 8, right: 12, bottom: 0, left: 12 }}
        >
          <CartesianGrid stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: CHART_AXIS_TEXT_COLOR }}
            axisLine={{ stroke: CHART_GRID_COLOR }}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          {crossesZero && (
            <ReferenceLine y={0} stroke={CHART_AXIS_TEXT_COLOR} />
          )}
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ stroke: CHART_GRID_COLOR }}
          />
          <Line
            dataKey="netWorth"
            name="Patrimônio"
            type="monotone"
            stroke={CHART_PRIMARY_COLOR}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: CHART_PRIMARY_COLOR,
              stroke: 'var(--card)',
              strokeWidth: 2,
            }}
            activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
