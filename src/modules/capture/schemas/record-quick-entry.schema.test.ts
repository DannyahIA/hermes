import { describe, expect, it } from 'vitest';

import { recordQuickEntrySchema } from './record-quick-entry.schema';

const ENTRY = {
  description: 'Almoço',
  amount: 32.5,
  type: 'expense',
  accountId: '5f0c7c1e-8a4b-4b8e-9c3e-2a1d4f6b7c8d',
  categoryId: null,
  occurredAt: '2026-10-18T15:41:00.000Z',
};

describe('recordQuickEntrySchema', () => {
  it('keeps the exact moment and leaves a missing category out', () => {
    expect(recordQuickEntrySchema.parse(ENTRY)).toEqual({
      description: 'Almoço',
      amount: 32.5,
      type: 'expense',
      accountId: ENTRY.accountId,
      categoryId: undefined,
      occurredAt: new Date('2026-10-18T15:41:00.000Z'),
    });
  });

  it('rounds the amount to the cent', () => {
    expect(
      recordQuickEntrySchema.parse({ ...ENTRY, amount: 0.1 + 0.2 }).amount,
    ).toBe(0.3);
  });

  it.each([
    [{ description: '   ' }, 'Diga o que foi, como em "almoço 32,50".'],
    [{ amount: 0 }, 'O valor deve ser maior que zero.'],
    [{ amount: 1e12 }, 'O valor é alto demais.'],
    [{ accountId: '' }, 'Escolha uma conta.'],
    [{ occurredAt: 'ontem' }, 'Data inválida.'],
  ])('refuses %j', (change, message) => {
    const result = recordQuickEntrySchema.safeParse({ ...ENTRY, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});
