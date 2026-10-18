import { describe, expect, it } from 'vitest';

import { occurrencesToGenerate } from '@/core/value-objects/recurrence';

import { createRecurringTransactionSchema } from './create-recurring-transaction.schema';

describe('createRecurringTransactionSchema', () => {
  it('keeps the occurrence that falls on the end date', () => {
    const parsed = createRecurringTransactionSchema.parse({
      accountId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
      description: 'Academia',
      amount: '129.90',
      type: 'expense',
      dayRuleKind: 'fixed_day',
      dayRuleDay: '5',
      startDate: '2026-10-05',
      endDate: '2026-12-05',
    });

    expect(parsed.startDate).toEqual(new Date(2026, 9, 5));
    expect(
      occurrencesToGenerate(
        {
          dayRuleKind: 'fixed_day',
          dayRuleDay: 5,
          startDate: parsed.startDate!,
          endDate: parsed.endDate,
        },
        new Date(2027, 0, 31),
      ),
    ).toEqual([
      new Date(2026, 9, 5),
      new Date(2026, 10, 5),
      new Date(2026, 11, 5),
    ]);
  });
});
