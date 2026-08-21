import { DomainError } from '@/core/errors/domain-error';

/**
 * Raised when input fails validation — either Zod schema parsing at the
 * server-action boundary, or a value object rejecting a malformed primitive.
 */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
