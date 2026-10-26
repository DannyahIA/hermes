import { cn } from '@/shared/lib/cn';
import { formatCurrency } from '@/shared/lib/format-currency';

const WIDTH = 300;
const HEIGHT = 80;
const SLOT = WIDTH / 6;
const BAR = 26;

interface CategoryMonthChartProps {
  /** Six totals, oldest first; the last one is the selected month. */
  values: number[];
  /** Short month names, one per value: "mai", "jun". */
  labels: string[];
  /** The selected month's bar takes the category's color. */
  color?: string;
}

/**
 * Six bars on a shared scale, drawn as plain SVG. The selected month is
 * the last bar, in the category's color; the others are muted. The labels
 * sit in HTML under the bars, so they keep their size whatever the width.
 */
export function CategoryMonthChart({
  values,
  labels,
  color,
}: CategoryMonthChartProps) {
  const max = Math.max(0, ...values);
  const last = values.length - 1;
  const summary = labels
    .map((label, index) => `${label} ${formatCurrency(values[index] ?? 0)}`)
    .join(', ');

  return (
    <div>
      <svg
        role="img"
        aria-label={`Últimos seis meses: ${summary}.`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="text-foreground h-20 w-full overflow-visible"
      >
        <line
          x1={0}
          x2={WIDTH}
          y1={HEIGHT - 0.5}
          y2={HEIGHT - 0.5}
          strokeWidth={1}
          className="stroke-border"
        />
        {values.map((value, index) => {
          const height = max > 0 ? (value / max) * HEIGHT : 0;
          const selected = index === last;
          return (
            <rect
              key={labels[index] ?? index}
              x={index * SLOT + (SLOT - BAR) / 2}
              y={HEIGHT - height}
              width={BAR}
              height={height}
              fill={selected && color ? color : undefined}
              className={cn(
                selected
                  ? color
                    ? undefined
                    : 'fill-current'
                  : 'fill-muted-foreground/40',
              )}
            />
          );
        })}
      </svg>
      <div
        aria-hidden
        className="text-muted-foreground mt-1 grid grid-cols-6 text-center text-xs"
      >
        {labels.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className={cn(index === last && 'text-foreground font-medium')}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
