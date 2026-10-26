import type { DateRange } from '@/core/value-objects/date-range';

/** Spending this many points ahead of the calendar still counts as on pace. */
export const PACE_TOLERANCE = 0.1;

/**
 * How much of a period has gone by today, from 0 to 1. Whole days, so
 * "today" counts as gone by: on 17 October a monthly budget is 17/31 through.
 */
export function elapsedShareOf(period: DateRange, today: Date): number {
  return period.daysGoneBy(today) / period.lengthInDays;
}

export function isAheadOfPace(
  spentShare: number,
  elapsedShare: number,
): boolean {
  return spentShare > elapsedShare + PACE_TOLERANCE;
}
