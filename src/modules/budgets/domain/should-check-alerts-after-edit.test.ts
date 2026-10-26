import { describe, expect, it } from 'vitest';

import { shouldCheckAlertsAfterEdit } from './should-check-alerts-after-edit';

const before = {
  amount: 100,
  categoryId: 'mercado',
  occurredAt: new Date(2026, 9, 20, 12),
};

describe('shouldCheckAlertsAfterEdit', () => {
  it('does not check when only the description changed', () => {
    expect(shouldCheckAlertsAfterEdit(before, { ...before })).toBe(false);
    expect(
      shouldCheckAlertsAfterEdit(before, {
        ...before,
        occurredAt: new Date(before.occurredAt.getTime()),
      }),
    ).toBe(false);
  });

  it('checks when the amount went up', () => {
    expect(shouldCheckAlertsAfterEdit(before, { ...before, amount: 150 })).toBe(
      true,
    );
  });

  it('does not check when the amount went down', () => {
    expect(shouldCheckAlertsAfterEdit(before, { ...before, amount: 50 })).toBe(
      false,
    );
  });

  it('checks when the category changed', () => {
    expect(
      shouldCheckAlertsAfterEdit(before, { ...before, categoryId: 'lazer' }),
    ).toBe(true);
  });

  it('checks when the date changed', () => {
    expect(
      shouldCheckAlertsAfterEdit(before, {
        ...before,
        occurredAt: new Date(2026, 9, 21, 12),
      }),
    ).toBe(true);
  });
});
