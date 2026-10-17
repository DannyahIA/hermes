import { describe, expect, it } from 'vitest';

import { createBudgetSchema } from './create-budget.schema';

describe('createBudgetSchema', () => {
  it('takes the period as whole local days, so the last evening still counts', () => {
    const parsed = createBudgetSchema.parse({
      categoryId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
      amount: '1200',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
    });

    expect(parsed.periodStart).toEqual(new Date(2026, 9, 1));
    expect(parsed.periodEnd).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });
});
