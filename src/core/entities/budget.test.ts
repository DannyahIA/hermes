import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';
import { DateRange } from '@/core/value-objects/date-range';

import { Budget } from './budget';

function makeProps(
  overrides: Partial<ConstructorParameters<typeof Budget>[0]> = {},
) {
  return {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'cat-1',
    amount: 100,
    currency: 'BRL',
    kind: 'fixed' as const,
    limits: [],
    periodStart: new Date('2026-08-01'),
    periodEnd: new Date('2026-08-31') as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const fixedProps = makeProps({
  amount: 300,
  periodStart: new Date(2026, 8, 1),
  periodEnd: new Date(2026, 8, 30, 23, 59, 59, 999),
});

const monthlyProps = makeProps({
  kind: 'monthly',
  amount: 500,
  periodStart: new Date(2026, 9, 1),
  periodEnd: null,
});

describe('Budget', () => {
  it('rejects an amount of zero or less', () => {
    expect(() => new Budget(makeProps({ amount: 0 }))).toThrow(ValidationError);
  });

  it('rejects a period that ends before it starts', () => {
    expect(
      () =>
        new Budget(
          makeProps({
            periodStart: new Date('2026-08-31'),
            periodEnd: new Date('2026-08-01'),
          }),
        ),
    ).toThrow(ValidationError);
  });

  it('accepts a valid budget', () => {
    const budget = new Budget(makeProps());
    expect(budget.period.contains(new Date('2026-08-15'))).toBe(true);
    expect(budget.period.contains(new Date('2026-09-01'))).toBe(false);
  });

  describe('monthly', () => {
    const monthly = new Budget(monthlyProps);

    it('runs every month from its first one, each month a period of its own', () => {
      expect(monthly.kind).toBe('monthly');
      expect(monthly.runsOn(new Date(2026, 8, 30))).toBe(false);
      expect(monthly.runsOn(new Date(2026, 10, 3))).toBe(true);
      expect(monthly.periodFor(new Date(2026, 10, 3))).toEqual(
        DateRange.monthOf(new Date(2026, 10, 1)),
      );
    });

    it('answers with its first month for a date before it', () => {
      expect(monthly.periodFor(new Date(2026, 5, 10))).toEqual(
        DateRange.monthOf(new Date(2026, 9, 1)),
      );
    });

    it('keeps the period getter on its first month', () => {
      expect(monthly.period).toEqual(DateRange.monthOf(new Date(2026, 9, 1)));
    });

    it('keeps the old limit for past months when a monthly limit changes', () => {
      const changed = monthly.withLimit(700, new Date(2026, 10, 15));
      expect(changed.amountFor(new Date(2026, 9, 20))).toBe(500);
      expect(changed.amountFor(new Date(2026, 10, 2))).toBe(700);
      expect(changed.amount).toBe(700);
    });

    it('does not mutate the original budget when the limit changes', () => {
      monthly.withLimit(700, new Date(2026, 10, 15));
      expect(monthly.amount).toBe(500);
      expect(monthly.props.limits).toEqual([]);
    });

    it('chains limits and replaces one set twice for the same month', () => {
      const changed = monthly
        .withLimit(700, new Date(2026, 10, 15))
        .withLimit(900, new Date(2026, 11, 1))
        .withLimit(750, new Date(2026, 10, 20));
      expect(changed.amountFor(new Date(2026, 10, 25))).toBe(750);
      expect(changed.amountFor(new Date(2026, 11, 5))).toBe(900);
      expect(changed.amountFor(new Date(2026, 9, 5))).toBe(500);
      expect(changed.amount).toBe(900);
    });

    it('applies a limit set in the month a mid-month budget started', () => {
      const midMonth = new Budget({
        ...monthlyProps,
        periodStart: new Date(2026, 9, 15),
      });
      const sameMonth = midMonth.withLimit(700, new Date(2026, 9, 20));
      expect(sameMonth.amount).toBe(700);
      expect(sameMonth.amountFor(new Date(2026, 9, 20))).toBe(700);

      const nextMonth = midMonth.withLimit(700, new Date(2026, 10, 3));
      expect(nextMonth.amountFor(new Date(2026, 9, 20))).toBe(500);
      expect(nextMonth.amountFor(new Date(2026, 10, 5))).toBe(700);
    });

    it('falls back to the amount when there are no limits', () => {
      expect(monthly.amountFor(new Date(2026, 10, 2))).toBe(500);
    });

    it('updates updatedAt when the limit changes', () => {
      const past = new Date(2020, 0, 1);
      const old = new Budget({ ...monthlyProps, updatedAt: past });
      expect(
        old.withLimit(600, new Date(2026, 10, 1)).props.updatedAt.getTime(),
      ).toBeGreaterThan(past.getTime());
    });
  });

  describe('fixed', () => {
    const fixed = new Budget(fixedProps);

    it('runs a fixed budget only inside its dates and keeps them as its period', () => {
      expect(fixed.runsOn(new Date(2026, 9, 1))).toBe(false);
      expect(fixed.runsOn(new Date(2026, 8, 15))).toBe(true);
      expect(fixed.periodFor(new Date(2026, 9, 1))).toEqual(fixed.period);
    });

    it('replaces the limit of a fixed budget outright', () => {
      const changed = fixed.withLimit(800, new Date());
      expect(changed.amountFor(fixed.periodStart)).toBe(800);
      expect(changed.amount).toBe(800);
      expect(fixed.amount).toBe(300);
    });

    it('rejects a fixed budget without an end', () => {
      expect(() => new Budget({ ...fixedProps, periodEnd: null })).toThrow(
        ValidationError,
      );
    });
  });
});
