import { beforeEach, describe, expect, it } from 'vitest';

import { ApiToken } from '@/core/entities/api-token';
import { FakeApiTokenRepository } from '@/tests/fakes/fake-api-token.repository';

import { hashCaptureToken } from '../domain/capture-token';
import {
  AuthenticateCaptureTokenUseCase,
  CreateCaptureTokenUseCase,
  RevokeCaptureTokenUseCase,
} from './capture-tokens.use-case';

const NOW = new Date('2026-10-19T15:00:00.000Z');

describe('capture tokens', () => {
  let tokens: FakeApiTokenRepository;

  beforeEach(() => {
    tokens = new FakeApiTokenRepository();
  });

  it('shows a new token once and keeps only its hash', async () => {
    const { token, apiToken } = await new CreateCaptureTokenUseCase(
      tokens,
    ).execute({ userId: 'user-1', name: '  iPhone  ', now: NOW });

    const [stored] = await tokens.findByUserId('user-1');
    expect(stored.id).toBe(apiToken.id);
    expect(stored.name).toBe('iPhone');
    expect(stored.props.tokenHash).toBe(hashCaptureToken(token));
    expect(JSON.stringify(stored.props)).not.toContain(token);
  });

  it('lets a valid token in as its owner and notes when it was used', async () => {
    const { token } = await new CreateCaptureTokenUseCase(tokens).execute({
      userId: 'user-1',
      name: 'iPhone',
      now: NOW,
    });
    const later = new Date('2026-10-19T16:00:00.000Z');

    const authenticated = await new AuthenticateCaptureTokenUseCase(
      tokens,
    ).execute(token, later);

    expect(authenticated?.userId).toBe('user-1');
    expect((await tokens.findByUserId('user-1'))[0].lastUsedAt).toEqual(later);
  });

  it('turns away an unknown, revoked or differently scoped token', async () => {
    const authenticate = new AuthenticateCaptureTokenUseCase(tokens);
    const { token, apiToken } = await new CreateCaptureTokenUseCase(
      tokens,
    ).execute({ userId: 'user-1', name: 'iPhone', now: NOW });

    expect(await authenticate.execute('hm_nao-existe', NOW)).toBeNull();
    expect(await authenticate.execute('', NOW)).toBeNull();

    await new RevokeCaptureTokenUseCase(tokens).execute({
      userId: 'user-1',
      tokenId: apiToken.id,
      now: NOW,
    });
    expect(await authenticate.execute(token, NOW)).toBeNull();

    await tokens.save(
      new ApiToken({
        ...apiToken.props,
        id: 'other-scope',
        tokenHash: hashCaptureToken('hm_outro'),
        scope: 'admin' as never,
      }),
    );
    expect(await authenticate.execute('hm_outro', NOW)).toBeNull();
  });

  it("does not revoke someone else's token", async () => {
    const { apiToken } = await new CreateCaptureTokenUseCase(tokens).execute({
      userId: 'user-1',
      name: 'iPhone',
      now: NOW,
    });

    await expect(
      new RevokeCaptureTokenUseCase(tokens).execute({
        userId: 'someone-else',
        tokenId: apiToken.id,
        now: NOW,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
