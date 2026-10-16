import { describe, expect, it } from 'vitest';

import { calculatePeriodDelta } from './calculate-period-delta';

describe('calculatePeriodDelta', () => {
  it('computes a positive percentage delta', () => {
    expect(calculatePeriodDelta(150, 100)).toEqual({
      currentTotal: 150,
      previousTotal: 100,
      deltaPercent: 50,
    });
  });

  it('returns deltaPercent: null when the previous total is zero', () => {
    expect(calculatePeriodDelta(80, 0)).toEqual({
      currentTotal: 80,
      previousTotal: 0,
      deltaPercent: null,
    });
  });

  it('computes a negative delta when current is lower', () => {
    const result = calculatePeriodDelta(50, 100);
    expect(result.deltaPercent).toBe(-50);
  });
});
