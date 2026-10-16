export interface PeriodDelta {
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export function calculatePeriodDelta(
  currentTotal: number,
  previousTotal: number,
): PeriodDelta {
  return {
    currentTotal,
    previousTotal,
    deltaPercent:
      previousTotal === 0
        ? null
        : ((currentTotal - previousTotal) / previousTotal) * 100,
  };
}
