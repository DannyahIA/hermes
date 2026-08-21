import { ValidationError } from '@/core/errors/validation-error';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A validated, normalized (lowercased/trimmed) email address.
 */
export class Email {
  public readonly value: string;

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new ValidationError('Invalid email address.');
    }

    this.value = normalized;
  }

  toString(): string {
    return this.value;
  }
}
