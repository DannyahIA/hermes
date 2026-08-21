import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';

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
    periodStart: new Date('2026-08-01'),
    periodEnd: new Date('2026-08-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

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
});
