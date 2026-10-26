import { describe, expect, it } from 'vitest';

import {
  calculatePriceInstallments,
  splitEvenly,
  summarizeLoan,
} from './loan-amortization';

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

describe('summarizeLoan', () => {
  const loan = {
    principal: 25000,
    monthlyInterestRate: 0.02,
    installmentCount: 16,
  };

  it('summarizes R$ 25.000 at 2% a month over 16 installments, 3 paid', () => {
    const summary = summarizeLoan({ ...loan, paidCount: 3 });

    expect(summary.installment).toBeCloseTo(1841.25, 2);
    expect(summary.remainingCount).toBe(13);
    expect(summary.totalInterest).toBeCloseTo(4460, 0);
    expect(summary.totalCost).toBeCloseTo(29460, 0);
  });

  it('splits what is paid from what is left by the schedule itself', () => {
    const schedule = calculatePriceInstallments(loan);
    const summary = summarizeLoan({ ...loan, paidCount: 3 });

    expect(summary.paid).toBeCloseTo(
      schedule.slice(0, 3).reduce((sum, i) => sum + i.amount, 0),
      2,
    );
    expect(summary.remaining).toBeCloseTo(
      schedule.slice(3).reduce((sum, i) => sum + i.amount, 0),
      2,
    );
  });

  it('owes everything when nothing is paid and nothing when all is', () => {
    const none = summarizeLoan({ ...loan, paidCount: 0 });
    expect(none.paid).toBe(0);
    expect(none.remainingCount).toBe(16);

    const all = summarizeLoan({ ...loan, paidCount: 16 });
    expect(all.remaining).toBe(0);
    expect(all.remainingCount).toBe(0);
    expect(all.paid).toBeCloseTo(all.totalCost, 0);
  });

  it('never counts more paid than there are installments', () => {
    const summary = summarizeLoan({ ...loan, paidCount: 20 });

    expect(summary.remainingCount).toBe(0);
    expect(summary.remaining).toBe(0);
  });

  it('has no interest at a rate of zero', () => {
    const summary = summarizeLoan({
      principal: 1200,
      monthlyInterestRate: 0,
      installmentCount: 12,
      paidCount: 2,
    });

    expect(summary.installment).toBe(100);
    expect(summary.totalInterest).toBe(0);
    expect(summary.totalCost).toBe(1200);
    expect(summary.paid).toBe(200);
    expect(summary.remaining).toBe(1000);
  });
});
