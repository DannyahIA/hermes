import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatDayLabel,
  formatOccurredAt,
  formatTimeOfDay,
} from './format-date';

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

describe('formatDayLabel', () => {
  const today = new Date(2026, 9, 17, 15, 30);

  it('names today and yesterday, and spells out older days', () => {
    expect(formatDayLabel(new Date(2026, 9, 17, 9), today)).toBe('Hoje');
    expect(formatDayLabel(new Date(2026, 9, 16, 23), today)).toBe('Ontem');
    expect(formatDayLabel(new Date(2026, 9, 12, 8), today)).toBe(
      'seg., 12 de out.',
    );
  });
});

describe('formatTimeOfDay', () => {
  it('has no time for an entry stored at midnight', () => {
    expect(formatTimeOfDay(new Date(2026, 9, 17))).toBeNull();
    expect(formatTimeOfDay(new Date(2026, 9, 17, 12, 41))).toBe('12:41');
  });
});
