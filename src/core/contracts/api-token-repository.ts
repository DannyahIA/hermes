import type { ApiToken } from '@/core/entities/api-token';

export interface ApiTokenRepository {
  findById(id: string): Promise<ApiToken | null>;
  findByHash(tokenHash: string): Promise<ApiToken | null>;
  /** Newest first, revoked ones included. */
  findByUserId(userId: string): Promise<ApiToken[]>;
  save(token: ApiToken): Promise<void>;
}
