import { ValidationError } from '@/core/errors/validation-error';

/**
 * An inclusive start/end date interval. Used by `Budget` to represent the
 * period a limit applies to.
 */
export class DateRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {
    if (start > end) {
      throw new ValidationError(
        'The period start date cannot be after the end date.',
      );
    }
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }
}
