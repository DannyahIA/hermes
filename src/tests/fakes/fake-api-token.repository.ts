import type { ApiTokenRepository } from '@/core/contracts/api-token-repository';
import type { ApiToken } from '@/core/entities/api-token';

export class FakeApiTokenRepository implements ApiTokenRepository {
  private readonly tokens = new Map<string, ApiToken>();

  async findById(id: string): Promise<ApiToken | null> {
    return this.tokens.get(id) ?? null;
  }

  async findByHash(tokenHash: string): Promise<ApiToken | null> {
    return (
      [...this.tokens.values()].find(
        (token) => token.props.tokenHash === tokenHash,
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<ApiToken[]> {
    return [...this.tokens.values()]
      .filter((token) => token.userId === userId)
      .sort(
        (a, b) => b.props.createdAt.getTime() - a.props.createdAt.getTime(),
      );
  }

  async save(token: ApiToken): Promise<void> {
    this.tokens.set(token.id, token);
  }
}
