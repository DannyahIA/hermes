import { ValidationError } from '@/core/errors/validation-error';

/**
 * A three-letter ISO 4217 currency code (e.g. "BRL", "USD").
 */
export class Currency {
  public readonly code: string;

  constructor(code: string) {
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new ValidationError(
        'Currency code must be a three-letter ISO code.',
      );
    }
    this.code = code;
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }

  toString(): string {
    return this.code;
  }
}
