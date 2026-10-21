import { randomBytes, randomUUID } from 'node:crypto';

import type { ChatLinkRepository } from '@/core/contracts/chat-link-repository';
import { type ChatChannelKind, ChatLink } from '@/core/entities/chat-link';
import { ChatLinkCode } from '@/core/entities/chat-link-code';

const CODE_LIFETIME_MS = 10 * 60_000;

/**
 * The one-time code behind "Abrir no Telegram" (spec 2026-10-17-telegram-
 * apple-pay-design.md §5.1): good for ten minutes, in the characters a
 * t.me start link allows.
 */
export class CreateChatLinkCodeUseCase {
  constructor(private readonly links: ChatLinkRepository) {}

  async execute(input: {
    userId: string;
    now?: Date;
  }): Promise<{ code: string; expiresAt: Date }> {
    const now = input.now ?? new Date();
    const code = new ChatLinkCode({
      code: randomBytes(16).toString('base64url'),
      userId: input.userId,
      expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
    });
    await this.links.saveCode(code);
    return { code: code.code, expiresAt: code.props.expiresAt };
  }
}

/**
 * Connects the chat that started the bot with a fresh code to the code's
 * owner. A user talks to Hermes from one chat, and a chat speaks for one
 * user: whatever was linked before on either side is disconnected. Null
 * when the code is unknown, used or expired.
 */
export class LinkChatUseCase {
  constructor(private readonly links: ChatLinkRepository) {}

  async execute(input: {
    code: string;
    channel: ChatChannelKind;
    externalChatId: string;
    username?: string;
    now?: Date;
  }): Promise<ChatLink | null> {
    const now = input.now ?? new Date();
    const code = await this.links.findCode(input.code);
    if (!code?.usableAt(now)) return null;
    await this.links.saveCode(code.use(now));

    for (const previous of [
      await this.links.findActiveByUserId(code.userId),
      await this.links.findActiveByChat(input.channel, input.externalChatId),
    ]) {
      if (previous) await this.links.save(previous.revoke(now));
    }

    const link = new ChatLink({
      id: randomUUID(),
      userId: code.userId,
      channel: input.channel,
      externalChatId: input.externalChatId,
      username: input.username,
      linkedAt: now,
    });
    await this.links.save(link);
    return link;
  }
}

/** Stops talking to the user's chat; the link is kept, revoked. */
export class UnlinkChatUseCase {
  constructor(private readonly links: ChatLinkRepository) {}

  async execute(input: { userId: string; now?: Date }): Promise<void> {
    const link = await this.links.findActiveByUserId(input.userId);
    if (link) await this.links.save(link.revoke(input.now ?? new Date()));
  }
}
