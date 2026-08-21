import { ValidationError } from '@/core/errors/validation-error';

/**
 * An amount tied to a currency. Arithmetic is refused across mismatched
 * currencies so a bug can never silently mix BRL and USD, and every
 * constructed instance is guaranteed to hold a finite number.
 */
export class Money {
  constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {
    if (!Number.isFinite(amount)) {
      throw new ValidationError('Money amount must be a finite number.');
    }
  }

  get value(): number {
    return this.amount;
  }

  get currencyCode(): string {
    return this.currency;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.value, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.value, this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currencyCode) {
      throw new ValidationError(
        'Cannot operate on money with different currencies.',
      );
    }
  }
}
