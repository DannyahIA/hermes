import { describe, expect, it } from 'vitest';

import { createTransactionSchema } from './create-transaction.schema';

const VALID = {
  accountId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
  description: 'Mercado',
  amount: '250.40',
  type: 'expense',
};

describe('createTransactionSchema', () => {
  it('reads a typed date as that day in local time, not 21:00 the day before', () => {
    const parsed = createTransactionSchema.parse({
      ...VALID,
      occurredAt: '2026-10-18',
    });

    expect(parsed.occurredAt).toEqual(new Date(2026, 9, 18));
  });

  it('leaves the date out when none was given', () => {
    expect(createTransactionSchema.parse(VALID).occurredAt).toBeUndefined();
  });

  it('says so when the date is not a date', () => {
    const result = createTransactionSchema.safeParse({
      ...VALID,
      occurredAt: 'ontem',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Informe uma data válida.');
  });
});
