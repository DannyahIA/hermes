import { describe, expect, it } from 'vitest';

import { calculatePriceInstallments, splitEvenly } from './loan-amortization';

describe('splitEvenly', () => {
  it('splits an amount evenly with no remainder', () => {
    expect(splitEvenly(300, 3)).toEqual([100, 100, 100]);
  });

  it('puts the rounding remainder on the last installment', () => {
    const parts = splitEvenly(100, 3);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(parts.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100, 2);
  });
});

describe('calculatePriceInstallments', () => {
  it('degrades to an even split when the rate is zero', () => {
    const schedule = calculatePriceInstallments({
      principal: 1200,
      monthlyInterestRate: 0,
      installmentCount: 12,
    });

    expect(schedule).toHaveLength(12);
    expect(schedule[0].amount).toBe(100);
    expect(schedule[11].remainingBalance).toBe(0);
    expect(
      schedule.reduce((sum, i) => sum + i.principalPortion, 0),
    ).toBeCloseTo(1200, 2);
  });

  it('produces a constant installment amount with decreasing interest and increasing principal', () => {
    const schedule = calculatePriceInstallments({
      principal: 1000,
      monthlyInterestRate: 0.02,
      installmentCount: 6,
    });

    // Price = a fixed installment amount, except the very last one, which
    // absorbs whatever rounding drift accumulated over the schedule so the
    // balance closes at exactly zero.
    const regularAmounts = new Set(schedule.slice(0, -1).map((i) => i.amount));
    expect(regularAmounts.size).toBe(1);

    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i].interestPortion).toBeLessThan(
        schedule[i - 1].interestPortion,
      );
      expect(schedule[i].principalPortion).toBeGreaterThan(
        schedule[i - 1].principalPortion,
      );
    }

    expect(schedule.at(-1)!.remainingBalance).toBe(0);
    // Total principal repaid must equal the amount borrowed.
    expect(
      schedule.reduce((sum, i) => sum + i.principalPortion, 0),
    ).toBeCloseTo(1000, 1);
  });

  it('rejects a non-positive principal', () => {
    expect(() =>
      calculatePriceInstallments({
        principal: 0,
        monthlyInterestRate: 0.01,
        installmentCount: 3,
      }),
    ).toThrow();
  });
});
