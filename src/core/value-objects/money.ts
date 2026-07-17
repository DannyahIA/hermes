export class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {
    if (!Number.isFinite(amount)) {
      throw new Error('Money amount must be a finite number.');
    }
  }

  get value() {
    return this.amount;
  }

  get currencyCode() {
    return this.currency;
  }

  add(other: Money) {
    if (this.currency !== other.currencyCode) {
      throw new Error('Cannot add money with different currencies.');
    }

    return new Money(this.amount + other.value, this.currency);
  }

  subtract(other: Money) {
    if (this.currency !== other.currencyCode) {
      throw new Error('Cannot subtract money with different currencies.');
    }

    return new Money(this.amount - other.value, this.currency);
  }
}
