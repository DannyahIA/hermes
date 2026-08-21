import { ValidationError } from '@/core/errors/validation-error';

/**
 * A password that meets Hermes' minimum strength bar. Only ever holds the
 * plaintext transiently during registration/change-password validation —
 * it is never persisted; better-auth handles hashing and storage.
 */
export class Password {
  public readonly value: string;

  constructor(value: string) {
    if (value.length < 8) {
      throw new ValidationError('Password must contain at least 8 characters.');
    }
    if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
      throw new ValidationError(
        'Password must contain uppercase, lowercase and a number.',
      );
    }
    this.value = value;
  }
}
