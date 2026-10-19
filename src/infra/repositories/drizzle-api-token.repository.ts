import { desc, eq } from 'drizzle-orm';

import type { ApiTokenRepository } from '@/core/contracts/api-token-repository';
import { ApiToken, type ApiTokenScope } from '@/core/entities/api-token';
import type { Executor } from '@/infra/database/client';
import { db } from '@/infra/database/client';
import { apiTokens } from '@/infra/database/schema';

type ApiTokenRow = typeof apiTokens.$inferSelect;

function toDomain(row: ApiTokenRow): ApiToken {
  return new ApiToken({
    id: row.id,
    userId: row.userId,
    name: row.name,
    tokenHash: row.tokenHash,
    prefix: row.prefix,
    scope: row.scope as ApiTokenScope,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? undefined,
    revokedAt: row.revokedAt ?? undefined,
  });
}

export class DrizzleApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly executor: Executor = db) {}

  async findById(id: string): Promise<ApiToken | null> {
    const [row] = await this.executor
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.id, id))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByHash(tokenHash: string): Promise<ApiToken | null> {
    const [row] = await this.executor
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<ApiToken[]> {
    const rows = await this.executor
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, userId))
      .orderBy(desc(apiTokens.createdAt));
    return rows.map(toDomain);
  }

  async save(token: ApiToken): Promise<void> {
    const values = {
      name: token.props.name,
      lastUsedAt: token.props.lastUsedAt ?? null,
      revokedAt: token.props.revokedAt ?? null,
    };
    await this.executor
      .insert(apiTokens)
      .values({
        ...values,
        id: token.id,
        userId: token.userId,
        tokenHash: token.props.tokenHash,
        prefix: token.prefix,
        scope: token.props.scope,
        createdAt: token.props.createdAt,
      })
      .onConflictDoUpdate({ target: apiTokens.id, set: values });
  }
}
