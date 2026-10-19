import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateTime,
  formatDayHeading,
  formatDayLabel,
  formatMonthHeading,
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

describe('formatDayHeading', () => {
  it('names today and yesterday, and spells out older days', () => {
    expect(formatDayHeading('2026-10-19', '2026-10-19')).toBe('Hoje');
    expect(formatDayHeading('2026-10-18', '2026-10-19')).toBe('Ontem');
    expect(formatDayHeading('2026-10-13', '2026-10-19')).toBe(
      'ter., 13 de out.',
    );
    expect(formatDayHeading('2026-10-20', '2026-10-19')).toBe('Amanhã');
  });

  it('adds the year outside the current one', () => {
    expect(formatDayHeading('2025-12-31', '2026-01-02')).toBe(
      '31 de dez. de 2025',
    );
    expect(formatDayHeading('2027-03-08', '2026-10-19')).toBe(
      '8 de mar. de 2027',
    );
  });

  it('counts days across a daylight saving change', () => {
    expect(formatDayHeading('2026-11-01', '2026-11-02')).toBe('Ontem');
  });
});

describe('formatMonthHeading', () => {
  it('names the month and its year', () => {
    expect(formatMonthHeading('2026-10')).toBe('Outubro de 2026');
    expect(formatMonthHeading('2027-03')).toBe('Março de 2027');
  });
});
