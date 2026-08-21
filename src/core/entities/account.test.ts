import { describe, expect, it } from 'vitest';

import { DomainError } from '@/core/errors/domain-error';

import { Account } from './account';

function makeAccount(
  overrides: Partial<ConstructorParameters<typeof Account>[0]> = {},
) {
  return new Account({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Conta',
    type: 'checking',
    balance: 100,
    currency: 'BRL',
    archived: false,
    hidden: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

describe('Account', () => {
  it('rejects an invalid (non-finite) balance', () => {
    expect(() => makeAccount({ balance: Number.NaN })).toThrow(DomainError);
  });

  it('withBalanceDelta applies the delta immutably', () => {
    const account = makeAccount();
    const updated = account.withBalanceDelta(-30);

    expect(updated.balance).toBe(70);
    expect(account.balance).toBe(100); // original untouched
  });

  it('withBalanceDelta refuses to post to an archived account', () => {
    const account = makeAccount({ archived: true });

    expect(() => account.withBalanceDelta(10)).toThrow(DomainError);
  });

  it('update never accepts a balance field (compile-time — not editable at all)', () => {
    const account = makeAccount();
    const updated = account.update({ name: 'Nova conta' });

    expect(updated.balance).toBe(account.balance);
  });

  describe('deltaFor', () => {
    it('income increases a checking account balance', () => {
      const account = makeAccount({ type: 'checking' });
      expect(account.deltaFor('income', 50)).toBe(50);
    });

    it('expense decreases a checking account balance', () => {
      const account = makeAccount({ type: 'checking' });
      expect(account.deltaFor('expense', 50)).toBe(-50);
    });

    it('expense INCREASES a credit account balance (it accrues debt)', () => {
      const account = makeAccount({ type: 'credit' });
      expect(account.deltaFor('expense', 50)).toBe(50);
    });

    it('income DECREASES a credit account balance (e.g. a refund reduces what you owe)', () => {
      const account = makeAccount({ type: 'credit' });
      expect(account.deltaFor('income', 50)).toBe(-50);
    });
  });

  describe('nextDueDate', () => {
    it('returns null for a non-credit account', () => {
      const account = makeAccount({ type: 'checking', dueDay: 10 });
      expect(account.nextDueDate(new Date('2026-08-15'))).toBeNull();
    });

    it('returns null when no dueDay is set', () => {
      const account = makeAccount({ type: 'credit' });
      expect(account.nextDueDate(new Date('2026-08-15'))).toBeNull();
    });

    it("returns this month's due date when it has not passed yet", () => {
      const account = makeAccount({ type: 'credit', dueDay: 20 });
      const due = account.nextDueDate(new Date('2026-08-15'));
      expect(due?.getMonth()).toBe(7); // August (0-indexed)
      expect(due?.getDate()).toBe(20);
    });

    it('rolls over to next month once the due day has passed', () => {
      const account = makeAccount({ type: 'credit', dueDay: 10 });
      const due = account.nextDueDate(new Date('2026-08-15'));
      expect(due?.getMonth()).toBe(8); // September
      expect(due?.getDate()).toBe(10);
    });
  });
});
