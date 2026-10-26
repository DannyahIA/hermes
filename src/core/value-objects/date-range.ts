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

  /** The calendar month containing `date`, in local time. */
  static monthOf(date: Date): DateRange {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new DateRange(
      new Date(year, month, 1),
      new Date(year, month + 1, 0, 23, 59, 59, 999),
    );
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }
}
