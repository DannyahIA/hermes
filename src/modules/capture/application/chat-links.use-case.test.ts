import { beforeEach, describe, expect, it } from 'vitest';

import { FakeChatLinkRepository } from '@/tests/fakes/fake-chat-link.repository';

import {
  CreateChatLinkCodeUseCase,
  LinkChatUseCase,
  UnlinkChatUseCase,
} from './chat-links.use-case';

const NOW = new Date('2026-10-19T15:00:00.000Z');
const minutesLater = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

describe('connecting a Telegram chat', () => {
  let links: FakeChatLinkRepository;
  let link: LinkChatUseCase;

  async function codeFor(userId: string) {
    return (
      await new CreateChatLinkCodeUseCase(links).execute({ userId, now: NOW })
    ).code;
  }

  beforeEach(() => {
    links = new FakeChatLinkRepository();
    link = new LinkChatUseCase(links);
  });

  it('gives a code that fits in a t.me start link', async () => {
    const { code, expiresAt } = await new CreateChatLinkCodeUseCase(
      links,
    ).execute({ userId: 'user-1', now: NOW });

    expect(code).toMatch(/^[A-Za-z0-9_-]{16,32}$/);
    expect(expiresAt).toEqual(minutesLater(10));
  });

  it('links the chat that starts the bot with a fresh code', async () => {
    const code = await codeFor('user-1');

    const linked = await link.execute({
      code,
      channel: 'telegram',
      externalChatId: '5551234',
      username: 'dan',
      now: minutesLater(2),
    });

    expect(linked?.userId).toBe('user-1');
    expect(
      (await links.findActiveByChat('telegram', '5551234'))?.username,
    ).toBe('dan');
  });

  it('turns away a code that is unknown, used or older than ten minutes', async () => {
    const used = await codeFor('user-1');
    await link.execute({
      code: used,
      channel: 'telegram',
      externalChatId: '1',
      now: NOW,
    });
    const stale = await codeFor('user-2');

    for (const [code, now] of [
      ['nao-existe', NOW],
      [used, NOW],
      [stale, minutesLater(11)],
    ] as const) {
      expect(
        await link.execute({
          code,
          channel: 'telegram',
          externalChatId: '2',
          now,
        }),
      ).toBeNull();
    }
    expect(await links.findActiveByChat('telegram', '2')).toBeNull();
  });

  it('keeps one chat per user and one user per chat', async () => {
    await link.execute({
      code: await codeFor('user-1'),
      channel: 'telegram',
      externalChatId: 'old-phone',
      now: NOW,
    });
    await link.execute({
      code: await codeFor('user-2'),
      channel: 'telegram',
      externalChatId: 'shared',
      now: NOW,
    });

    await link.execute({
      code: await codeFor('user-1'),
      channel: 'telegram',
      externalChatId: 'shared',
      now: minutesLater(1),
    });

    expect(await links.findActiveByChat('telegram', 'old-phone')).toBeNull();
    expect((await links.findActiveByChat('telegram', 'shared'))?.userId).toBe(
      'user-1',
    );
    expect(await links.findActiveByUserId('user-2')).toBeNull();
  });

  it('disconnects, keeping the link as revoked', async () => {
    await link.execute({
      code: await codeFor('user-1'),
      channel: 'telegram',
      externalChatId: '5551234',
      now: NOW,
    });

    await new UnlinkChatUseCase(links).execute({
      userId: 'user-1',
      now: minutesLater(5),
    });

    expect(await links.findActiveByUserId('user-1')).toBeNull();
    expect([...links.links.values()]).toHaveLength(1);
  });
});
