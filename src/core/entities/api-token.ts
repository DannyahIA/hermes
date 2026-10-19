/** What a token may do. A capture token only records payments; it reads nothing. */
export type ApiTokenScope = 'capture:write';

export interface ApiTokenProps {
  id: string;
  userId: string;
  /** What the user called it: "iPhone". */
  name: string;
  /** SHA-256 of the token, in hex. The token itself is never stored. */
  tokenHash: string;
  /** The token's first characters, to tell tokens apart: "hm_3fa9c1". */
  prefix: string;
  scope: ApiTokenScope;
  createdAt: Date;
  lastUsedAt?: Date;
  revokedAt?: Date;
}

/**
 * A personal token for something that can't hold a browser session — the
 * iPhone shortcut that reports Apple Pay payments (spec
 * 2026-10-17-telegram-apple-pay-design.md §8).
 */
export class ApiToken {
  constructor(public readonly props: ApiTokenProps) {}

  get id() {
    return this.props.id;
  }
  get userId() {
    return this.props.userId;
  }
  get name() {
    return this.props.name;
  }
  get prefix() {
    return this.props.prefix;
  }
  get lastUsedAt() {
    return this.props.lastUsedAt;
  }
  get revoked() {
    return this.props.revokedAt !== undefined;
  }

  allows(scope: ApiTokenScope): boolean {
    return !this.revoked && this.props.scope === scope;
  }

  usedAt(now: Date): ApiToken {
    return new ApiToken({ ...this.props, lastUsedAt: now });
  }

  revoke(now: Date): ApiToken {
    return this.revoked
      ? this
      : new ApiToken({ ...this.props, revokedAt: now });
  }
}
