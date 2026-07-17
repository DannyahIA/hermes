export class DateRange {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {
    if (start > end) {
      throw new Error('DateRange start cannot be after end.');
    }
  }
}
