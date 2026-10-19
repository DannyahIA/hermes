import { randomUUID } from 'node:crypto';

import type { ApiTokenRepository } from '@/core/contracts/api-token-repository';
import { ApiToken } from '@/core/entities/api-token';
import { NotFoundError } from '@/core/errors/not-found-error';

import {
  generateCaptureToken,
  hashCaptureToken,
} from '../domain/capture-token';

/**
 * A token for the iPhone shortcut (spec 2026-10-17-telegram-apple-pay-
 * design.md §5.2, §8). The token comes back once, here; only its hash is
 * kept.
 */
export class CreateCaptureTokenUseCase {
  constructor(private readonly tokens: ApiTokenRepository) {}

  async execute(input: {
    userId: string;
    name: string;
    now?: Date;
  }): Promise<{ token: string; apiToken: ApiToken }> {
    const { token, hash, prefix } = generateCaptureToken();
    const apiToken = new ApiToken({
      id: randomUUID(),
      userId: input.userId,
      name: input.name.trim().slice(0, 80) || 'iPhone',
      tokenHash: hash,
      prefix,
      scope: 'capture:write',
      createdAt: input.now ?? new Date(),
    });
    await this.tokens.save(apiToken);
    return { token, apiToken };
  }
}

/**
 * Who a capture comes from: the owner of an active token allowed to
 * record captures, or nobody.
 */
export class AuthenticateCaptureTokenUseCase {
  constructor(private readonly tokens: ApiTokenRepository) {}

  async execute(token: string, now = new Date()): Promise<ApiToken | null> {
    if (!token) return null;
    const apiToken = await this.tokens.findByHash(hashCaptureToken(token));
    if (!apiToken?.allows('capture:write')) return null;

    const used = apiToken.usedAt(now);
    await this.tokens.save(used);
    return used;
  }
}

export class RevokeCaptureTokenUseCase {
  constructor(private readonly tokens: ApiTokenRepository) {}

  async execute(input: {
    userId: string;
    tokenId: string;
    now?: Date;
  }): Promise<void> {
    const apiToken = await this.tokens.findById(input.tokenId);
    if (!apiToken || apiToken.userId !== input.userId) {
      throw new NotFoundError('ApiToken', input.tokenId);
    }
    await this.tokens.save(apiToken.revoke(input.now ?? new Date()));
  }
}
