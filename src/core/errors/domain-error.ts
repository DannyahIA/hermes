/**
 * Base class for every error raised by a business-rule violation inside
 * `core`/`modules`. Never thrown as a bare string or plain `Error` — always
 * this or a subclass, so callers (server actions, tests) can branch on
 * `error.code` instead of parsing messages.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
