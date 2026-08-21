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
});
