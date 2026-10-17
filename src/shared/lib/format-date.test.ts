import { describe, expect, it } from 'vitest';

import { formatDate, formatDateTime, formatOccurredAt } from './format-date';

describe('formatOccurredAt', () => {
  it('leaves the time off a date-only entry, stored at local midnight', () => {
    const date = new Date(2026, 9, 10);
    expect(formatOccurredAt(date)).toBe(formatDate(date));
  });

  it('keeps the time when one was recorded', () => {
    const date = new Date(2026, 9, 10, 12, 41);
    expect(formatOccurredAt(date)).toBe(formatDateTime(date));
  });
});
