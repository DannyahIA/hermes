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

  it('creates a monthly budget by default, starting this month', () => {
    const parsed = createBudgetSchema.parse({
      categoryId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
      amount: '1200',
    });

    expect(parsed.kind).toBe('monthly');
    expect(parsed.periodStart).toBeUndefined();
    expect(parsed.periodEnd).toBeUndefined();
  });

  it('reads empty date fields as no dates, so a monthly form can leave them out', () => {
    const parsed = createBudgetSchema.parse({
      categoryId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
      amount: '1200',
      kind: 'monthly',
      periodStart: '',
      periodEnd: null,
    });

    expect(parsed.periodStart).toBeUndefined();
    expect(parsed.periodEnd).toBeUndefined();
  });

  it('still requires both dates for a budget with dates', () => {
    const base = {
      categoryId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
      amount: '1200',
      kind: 'fixed',
    };

    const noEnd = createBudgetSchema.safeParse({
      ...base,
      periodStart: '2026-10-01',
    });
    const noStart = createBudgetSchema.safeParse({
      ...base,
      periodEnd: '2026-10-31',
    });

    expect(noEnd.error?.issues[0]?.path).toEqual(['periodEnd']);
    expect(noStart.error?.issues[0]?.path).toEqual(['periodStart']);
  });

  it('rejects an end before the start for a budget with dates', () => {
    const result = createBudgetSchema.safeParse({
      categoryId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
      amount: '1200',
      kind: 'fixed',
      periodStart: '2026-10-31',
      periodEnd: '2026-10-01',
    });

    expect(result.error?.issues[0]?.path).toEqual(['periodEnd']);
  });
});
