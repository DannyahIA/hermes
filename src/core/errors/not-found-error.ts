import { DomainError } from '@/core/errors/domain-error';

/**
 * Raised when a use-case looks up an entity by id and it doesn't exist (or
 * doesn't belong to the requesting user). Kept distinct from
 * `ValidationError` because it maps to a different presentation-layer
 * response (404-style "not found" vs. a form field error).
 */
export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} with id "${id}" was not found.`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}
