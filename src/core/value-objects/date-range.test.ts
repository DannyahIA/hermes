import { describe, expect, it } from 'vitest';

import { ValidationError } from '@/core/errors/validation-error';

import { DateRange } from './date-range';

describe('DateRange', () => {
  it('rejects a start date after the end date', () => {
    expect(
      () => new DateRange(new Date('2026-08-31'), new Date('2026-08-01')),
    ).toThrow(ValidationError);
  });

  it('contains() is inclusive of both boundaries', () => {
    const range = new DateRange(new Date('2026-08-01'), new Date('2026-08-31'));
    expect(range.contains(new Date('2026-08-01'))).toBe(true);
    expect(range.contains(new Date('2026-08-31'))).toBe(true);
    expect(range.contains(new Date('2026-09-01'))).toBe(false);
  });

  it('monthOf() spans the whole month in local time', () => {
    const range = DateRange.monthOf(new Date(2026, 1, 14, 10, 30));
    expect(range.start).toEqual(new Date(2026, 1, 1));
    expect(range.end).toEqual(new Date(2026, 1, 28, 23, 59, 59, 999));
    expect(DateRange.monthOf(new Date(2028, 1, 3)).end.getDate()).toBe(29);
  });

  it('counts whole days, first and last included', () => {
    const october = DateRange.monthOf(new Date(2026, 9, 5));
    expect(october.lengthInDays).toBe(31);
    expect(
      new DateRange(new Date(2026, 9, 10), new Date(2026, 9, 10)).lengthInDays,
    ).toBe(1);
  });

  it('daysGoneBy() counts today and stays inside the range', () => {
    const october = DateRange.monthOf(new Date(2026, 9, 5));
    expect(october.daysGoneBy(new Date(2026, 9, 10, 23, 59))).toBe(10);
    expect(october.daysGoneBy(new Date(2026, 9, 1, 0, 1))).toBe(1);
    expect(october.daysGoneBy(new Date(2026, 8, 20))).toBe(0);
    expect(october.daysGoneBy(new Date(2026, 10, 20))).toBe(31);
  });
});
