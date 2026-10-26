import { ValidationError } from '@/core/errors/validation-error';

/**
 * An inclusive start/end date interval. Used by `Budget` to represent the
 * period a limit applies to.
 */
const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

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

  /** Whole local days the range covers, its first and last day both counted. */
  get lengthInDays(): number {
    return (
      Math.round((startOfDay(this.end) - startOfDay(this.start)) / DAY) + 1
    );
  }

  /**
   * Whole local days gone by `today`, today included: on the 10th a range
   * that starts on the 1st has 10 gone. Never below 0 or past the length.
   */
  daysGoneBy(today: Date): number {
    const gone =
      Math.round((startOfDay(today) - startOfDay(this.start)) / DAY) + 1;
    return Math.min(this.lengthInDays, Math.max(0, gone));
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }
}
