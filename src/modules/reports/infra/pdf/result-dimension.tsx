import {
  Line,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';

import { formatCurrency } from '@/shared/lib/format-currency';

import { CONTENT_WIDTH, FONT, INK, textStyles, TYPE } from './pdf-theme';

const WIDTH = CONTENT_WIDTH;
const HEIGHT = 92;
/** The shared zero both bars are measured from. */
const DATUM_X = 62;
/** The right-hand column the two totals sit in, decimals aligned. */
const VALUE_COLUMN = 100;
const SPAN = WIDTH - DATUM_X - VALUE_COLUMN;
const BAR_HEIGHT = 13;
const INCOME_Y = 4;
const EXPENSE_Y = 30;
const DIMENSION_Y = 64;
const TICK = 4;
/** Drafting leaves a small gap between a part and its extension line. */
const EXTENSION_GAP = 2;
const LABEL_WIDTH = 220;

const styles = StyleSheet.create({
  drawing: {
    position: 'relative',
    width: WIDTH,
    height: HEIGHT,
  },
  rowLabel: {
    position: 'absolute',
    left: 0,
    width: DATUM_X - 8,
    fontSize: TYPE.body,
    fontWeight: 500,
  },
  value: {
    position: 'absolute',
    right: 0,
    width: VALUE_COLUMN - 12,
    textAlign: 'right',
    fontFamily: FONT.figure,
    fontSize: TYPE.body,
  },
  dimensionLabel: {
    position: 'absolute',
    top: DIMENSION_Y + 7,
    width: LABEL_WIDTH,
    textAlign: 'center',
    fontSize: TYPE.caption,
    color: INK.graphite,
  },
  dimensionFigure: {
    fontFamily: FONT.figure,
    fontWeight: 500,
    fontSize: TYPE.figure,
  },
});

/** Below this, the two end ticks would merge into one smudge. */
const MIN_INSIDE_SPAN = 18;
const LEADER = 14;
const ARROW_LENGTH = 5;
const ARROW_HALF_WIDTH = 2;

/** The usual form: a line between the two extension lines, a tick at each end. */
function insideDimension(start: number, end: number) {
  return [
    <Line
      key="line"
      x1={start}
      y1={DIMENSION_Y}
      x2={end}
      y2={DIMENSION_Y}
      stroke={INK.text}
      strokeWidth={0.75}
    />,
    ...[start, end].map((x) => (
      <Line
        key={`tick-${x}`}
        x1={x}
        y1={DIMENSION_Y - TICK}
        x2={x}
        y2={DIMENSION_Y + TICK}
        stroke={INK.text}
        strokeWidth={1}
      />
    )),
  ];
}

/**
 * A span too narrow to dimension from inside — say R$ 690 out of R$ 94.000 —
 * gets the drafting convention for that case: leaders from outside, with
 * arrowheads pointing in at the two extension lines.
 */
function outsideDimension(start: number, end: number) {
  const y = DIMENSION_Y;
  return [
    <Line
      key="leader-start"
      x1={start - LEADER}
      y1={y}
      x2={start}
      y2={y}
      stroke={INK.text}
      strokeWidth={0.75}
    />,
    <Line
      key="leader-end"
      x1={end}
      y1={y}
      x2={end + LEADER}
      y2={y}
      stroke={INK.text}
      strokeWidth={0.75}
    />,
    <Path
      key="arrow-start"
      d={`M ${start} ${y} L ${start - ARROW_LENGTH} ${y - ARROW_HALF_WIDTH} L ${start - ARROW_LENGTH} ${y + ARROW_HALF_WIDTH} Z`}
      fill={INK.text}
    />,
    <Path
      key="arrow-end"
      d={`M ${end} ${y} L ${end + ARROW_LENGTH} ${y - ARROW_HALF_WIDTH} L ${end + ARROW_LENGTH} ${y + ARROW_HALF_WIDTH} Z`}
      fill={INK.text}
    />,
  ];
}

interface ResultDimensionProps {
  income: number;
  expense: number;
}

/**
 * The period's result, drawn as a dimensioned part: income and expense as
 * two bars on one scale from a shared datum, and a dimension line measuring
 * the gap between their ends — the app's `.dimension-line` signature at
 * full size, so the eye reads the *difference* first, not two loose totals.
 */
export function ResultDimension({ income, expense }: ResultDimensionProps) {
  const largest = Math.max(income, expense);
  if (largest <= 0) {
    return (
      <Text style={textStyles.empty}>
        Nenhuma receita ou despesa registrada neste período.
      </Text>
    );
  }

  const xOf = (value: number) => DATUM_X + (value / largest) * SPAN;
  const incomeEnd = xOf(income);
  const expenseEnd = xOf(expense);
  const difference = income - expense;
  const dimensionStart = Math.min(incomeEnd, expenseEnd);
  const dimensionEnd = Math.max(incomeEnd, expenseEnd);
  const labelLeft = Math.min(
    Math.max((dimensionStart + dimensionEnd) / 2 - LABEL_WIDTH / 2, 0),
    WIDTH - LABEL_WIDTH,
  );

  return (
    <View style={styles.drawing}>
      <Svg width={WIDTH} height={HEIGHT}>
        {difference !== 0 && (
          <>
            {/* Extension lines first, so a bar crossing one hides it —
                the way a drawing treats a line passing behind a part. */}
            <Line
              x1={incomeEnd}
              y1={INCOME_Y + BAR_HEIGHT + EXTENSION_GAP}
              x2={incomeEnd}
              y2={DIMENSION_Y + TICK + 1}
              stroke={INK.graphite}
              strokeWidth={0.5}
            />
            <Line
              x1={expenseEnd}
              y1={EXPENSE_Y + BAR_HEIGHT + EXTENSION_GAP}
              x2={expenseEnd}
              y2={DIMENSION_Y + TICK + 1}
              stroke={INK.graphite}
              strokeWidth={0.5}
            />
            {dimensionEnd - dimensionStart >= MIN_INSIDE_SPAN
              ? insideDimension(dimensionStart, dimensionEnd)
              : outsideDimension(dimensionStart, dimensionEnd)}
          </>
        )}

        {income > 0 && (
          <Rect
            x={DATUM_X}
            y={INCOME_Y}
            width={incomeEnd - DATUM_X}
            height={BAR_HEIGHT}
            fill={INK.blueline}
          />
        )}
        {expense > 0 && (
          <Rect
            x={DATUM_X}
            y={EXPENSE_Y}
            width={expenseEnd - DATUM_X}
            height={BAR_HEIGHT}
            fill={INK.redline}
          />
        )}
        <Line
          x1={DATUM_X}
          y1={0}
          x2={DATUM_X}
          y2={EXPENSE_Y + BAR_HEIGHT + 4}
          stroke={INK.text}
          strokeWidth={1}
        />
      </Svg>

      <Text style={[styles.rowLabel, { top: INCOME_Y + 1 }]}>Receitas</Text>
      <Text style={[styles.rowLabel, { top: EXPENSE_Y + 1 }]}>Despesas</Text>
      <Text style={[styles.value, { top: INCOME_Y + 1.5 }]}>
        {formatCurrency(income)}
      </Text>
      <Text style={[styles.value, { top: EXPENSE_Y + 1.5 }]}>
        {formatCurrency(expense)}
      </Text>

      <Text style={[styles.dimensionLabel, { left: labelLeft }]}>
        {difference === 0 ? (
          'Receitas e despesas empatadas'
        ) : (
          <>
            {difference > 0 ? 'Sobra de ' : 'Déficit de '}
            <Text
              style={[
                styles.dimensionFigure,
                { color: difference > 0 ? INK.text : INK.redline },
              ]}
            >
              {formatCurrency(Math.abs(difference))}
            </Text>
          </>
        )}
      </Text>
    </View>
  );
}
