import { Line, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';

import { formatMonthLabel } from '@/shared/lib/format-date';

import { FONT, INK, TYPE } from './pdf-theme';

const MAX_BAR = 12;
/** The surface gap between touching bars of the same month. */
const BAR_GAP = 1.5;
/** Past this many months, label every nth month so the labels never collide. */
const MAX_LABELS = 12;
export const END_LABEL_BAND = 14;

const styles = StyleSheet.create({
  endLabel: {
    position: 'absolute',
    top: 0,
    right: 0,
    fontFamily: FONT.figure,
    fontSize: TYPE.label + 0.5,
    color: INK.text,
  },
  axis: {
    flexDirection: 'row',
    marginTop: 3,
  },
  tick: {
    fontSize: TYPE.label,
    color: INK.graphite,
    textAlign: 'center',
  },
});

export interface BarSeries {
  /** One value per month; `null` leaves that month's slot empty. */
  values: Array<number | null>;
  /** Picks the fill per value — e.g. blueline above zero, redline below. */
  fill: (value: number) => string;
}

interface MonthlyBarsProps {
  months: Date[];
  series: BarSeries[];
  width: number;
  height: number;
  /**
   * Direct label for the last month's value, set in a band above the plot at
   * its right edge — the endpoint is the value a reader looks for, and every
   * other month is in the sheet's table.
   */
  endLabel?: string;
}

/**
 * Month-by-month bars on a single zero baseline — grouped when there are
 * two series, diverging when values cross zero. Marks only: no gridlines and
 * no value axis, since the sheet prints the exact figures in a table.
 */
export function MonthlyBars({
  months,
  series,
  width,
  height,
  endLabel,
}: MonthlyBarsProps) {
  const plotTop = endLabel ? END_LABEL_BAND : 0;
  const plotHeight = height - plotTop;
  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const range = high - low || 1;
  const yOf = (value: number) =>
    plotTop + ((high - value) / range) * plotHeight;

  const band = width / Math.max(months.length, 1);
  const barWidth = Math.min(
    MAX_BAR,
    (band * 0.72 - BAR_GAP * (series.length - 1)) / series.length,
  );
  const groupWidth = barWidth * series.length + BAR_GAP * (series.length - 1);
  const labelEvery = Math.ceil(months.length / MAX_LABELS);

  return (
    <View>
      <View style={{ position: 'relative', width, height }}>
        <Svg width={width} height={height}>
          {series.map((s, seriesIndex) =>
            s.values.map((value, monthIndex) => {
              if (value === null || value === 0) return null;
              const top = yOf(Math.max(value, 0));
              const bottom = yOf(Math.min(value, 0));
              return (
                <Rect
                  key={`${seriesIndex}-${monthIndex}`}
                  x={
                    monthIndex * band +
                    (band - groupWidth) / 2 +
                    seriesIndex * (barWidth + BAR_GAP)
                  }
                  y={top}
                  width={barWidth}
                  height={Math.max(bottom - top, 0.5)}
                  fill={s.fill(value)}
                />
              );
            }),
          )}
          <Line
            x1={0}
            y1={yOf(0)}
            x2={width}
            y2={yOf(0)}
            stroke={INK.construction}
            strokeWidth={0.75}
          />
        </Svg>
        {endLabel && <Text style={styles.endLabel}>{endLabel}</Text>}
      </View>

      <View style={styles.axis}>
        {months.map((month, index) => (
          <Text
            key={month.toISOString()}
            style={[styles.tick, { width: band }]}
          >
            {index % labelEvery === 0 ? formatMonthLabel(month) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}
