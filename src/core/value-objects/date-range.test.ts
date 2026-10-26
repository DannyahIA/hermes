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
});
