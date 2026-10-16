interface StatTileProps {
  label: string;
  value: string;
  deltaPercent: number | null;
  /** Whether a positive delta is good news (income) or bad news (expense). */
  upIsGood: boolean;
}

/**
 * A headline number with its change against a named prior period. The delta's
 * color is direction × whether up is good — more income is green, more
 * expense is red — and the arrow repeats that direction in a second,
 * non-color channel so the sign never rests on hue alone.
 */
export function StatTile({
  label,
  value,
  deltaPercent,
  upIsGood,
}: StatTileProps) {
  const isUp = deltaPercent !== null && deltaPercent > 0;
  const isGoodDirection = isUp === upIsGood;

  return (
    <div className="border-border rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="dimension-figure mt-1 text-2xl font-semibold">{value}</p>
      {deltaPercent !== null ? (
        <p
          className={`mt-1 text-sm ${isGoodDirection ? 'text-success' : 'text-destructive'}`}
        >
          <span aria-hidden>{isUp ? '↑' : '↓'}</span>{' '}
          {isUp ? '+' : ''}
          {deltaPercent.toFixed(1)}%
        </p>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm">Sem dado anterior</p>
      )}
    </div>
  );
}
